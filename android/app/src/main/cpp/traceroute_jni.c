#include <jni.h>
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/errqueue.h>
#include <netinet/in.h>
#include <netinet/ip.h>
#include <netinet/ip_icmp.h>
#include <poll.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

static atomic_int g_cancelled = 0;

static int64_t now_monotonic_us(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)ts.tv_sec * 1000000LL + (int64_t)(ts.tv_nsec / 1000L);
}

static uint16_t compute_icmp_checksum(const uint8_t *data, size_t len) {
    uint32_t sum = 0;
    size_t i = 0;
    while (i + 1 < len) {
        uint16_t word = (uint16_t)(((uint16_t)data[i] << 8) | (uint16_t)data[i + 1]);
        sum += word;
        i += 2;
    }
    if (i < len) {
        uint16_t word = (uint16_t)((uint16_t)data[i] << 8);
        sum += word;
    }
    while ((sum >> 16) != 0) {
        sum = (sum & 0xFFFFU) + (sum >> 16);
    }
    return (uint16_t)(~sum & 0xFFFFU);
}

static void drain_socket(int fd) {
    uint8_t buf[1500];
    char cbuf[512];
    for (int i = 0; i < 64; i++) {
        struct iovec iov;
        iov.iov_base = buf;
        iov.iov_len = sizeof(buf);
        struct msghdr msg;
        memset(&msg, 0, sizeof(msg));
        msg.msg_iov = &iov;
        msg.msg_iovlen = 1;
        msg.msg_control = cbuf;
        msg.msg_controllen = sizeof(cbuf);
        ssize_t r = recvmsg(fd, &msg, MSG_ERRQUEUE | MSG_DONTWAIT);
        if (r < 0) {
            break;
        }
    }
    for (int i = 0; i < 64; i++) {
        ssize_t r = recv(fd, buf, sizeof(buf), MSG_DONTWAIT);
        if (r < 0) {
            break;
        }
    }
    int so_err = 0;
    socklen_t errlen = (socklen_t)sizeof(so_err);
    (void)getsockopt(fd, SOL_SOCKET, SO_ERROR, &so_err, &errlen);
}

static void clear_sticky_socket_error(int fd) {
    int so_err = 0;
    socklen_t errlen = (socklen_t)sizeof(so_err);
    (void)getsockopt(fd, SOL_SOCKET, SO_ERROR, &so_err, &errlen);
}

static int extract_echo_seq(const uint8_t *buf, ssize_t len, uint8_t expected_icmp_type, int *out_seq) {
    if (len >= 8 && buf[0] == expected_icmp_type) {
        *out_seq = (int)(((uint16_t)buf[6] << 8) | (uint16_t)buf[7]);
        return 1;
    }
    if (len >= 28 && (buf[0] >> 4) == 4) {
        int ihl = (buf[0] & 0x0F) * 4;
        if (ihl >= 20 && len >= ihl + 8 && buf[ihl] == expected_icmp_type) {
            *out_seq = (int)(((uint16_t)buf[ihl + 6] << 8) | (uint16_t)buf[ihl + 7]);
            return 1;
        }
    }
    return 0;
}

/* Reads one matching message from MSG_ERRQUEUE.
 * Returns 1 if matched (writes formatted result into out_buf), 0 if stale/unrelated, -1 if empty. */
static int read_one_errqueue(int fd, int seq_min, int seq_max, char *out_buf, size_t out_len) {
    uint8_t rbuf[512];
    char cbuf[512];
    struct sockaddr_in err_name;
    memset(&err_name, 0, sizeof(err_name));

    struct iovec iov;
    iov.iov_base = rbuf;
    iov.iov_len = sizeof(rbuf);

    struct msghdr msg;
    memset(&msg, 0, sizeof(msg));
    msg.msg_name = &err_name;
    msg.msg_namelen = sizeof(err_name);
    msg.msg_iov = &iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cbuf;
    msg.msg_controllen = sizeof(cbuf);

    ssize_t r = recvmsg(fd, &msg, MSG_ERRQUEUE | MSG_DONTWAIT);
    if (r < 0) {
        return -1;
    }
    int64_t recv_us = now_monotonic_us();

    int pkt_seq = seq_min;
    int has_seq = extract_echo_seq(rbuf, r, ICMP_ECHO, &pkt_seq);
    if (!has_seq && msg.msg_namelen >= (socklen_t)sizeof(struct sockaddr_in) && err_name.sin_port != 0) {
        pkt_seq = (int)ntohs(err_name.sin_port);
        has_seq = 1;
    }
    if (has_seq && (pkt_seq < seq_min || pkt_seq > seq_max)) {
        return 0;
    }

    for (struct cmsghdr *cmsg = CMSG_FIRSTHDR(&msg); cmsg != NULL; cmsg = CMSG_NXTHDR(&msg, cmsg)) {
        if ((cmsg->cmsg_level == SOL_IP || cmsg->cmsg_level == IPPROTO_IP) && cmsg->cmsg_type == IP_RECVERR) {
            const struct sock_extended_err *ee = (const struct sock_extended_err *)CMSG_DATA(cmsg);
            if (!ee) {
                continue;
            }
            if (ee->ee_origin == SO_EE_ORIGIN_ICMP) {
                char addr_str[INET_ADDRSTRLEN];
                addr_str[0] = '\0';
                const struct sockaddr *off = SO_EE_OFFENDER(ee);
                if (off && off->sa_family == AF_INET) {
                    const struct sockaddr_in *off4 = (const struct sockaddr_in *)off;
                    (void)inet_ntop(AF_INET, &off4->sin_addr, addr_str, sizeof(addr_str));
                }
                if (ee->ee_type == ICMP_TIME_EXCEEDED) {
                    snprintf(out_buf, out_len, "TIME_EXCEEDED|%d|%lld|%s", pkt_seq, (long long)recv_us, addr_str);
                    return 1;
                }
                if (ee->ee_type == ICMP_DEST_UNREACH) {
                    snprintf(out_buf, out_len, "UNREACHABLE|%d|%lld|%s", pkt_seq, (long long)recv_us, addr_str);
                    return 1;
                }
                return 0;
            }
            snprintf(out_buf, out_len, "ERROR|%d|%d|", pkt_seq, (int)ee->ee_errno);
            return 1;
        }
    }
    return 0;
}

/* Reads one matching Echo Reply from the normal socket receive queue.
 * Returns 1 if matched, 0 if stale/unrelated, -1 if empty. */
static int read_one_reply(int fd, int seq_min, int seq_max, char *out_buf, size_t out_len) {
    uint8_t rbuf[1500];
    struct sockaddr_in from_sin;
    memset(&from_sin, 0, sizeof(from_sin));
    socklen_t from_len = (socklen_t)sizeof(from_sin);

    ssize_t r = recvfrom(fd, rbuf, sizeof(rbuf), MSG_DONTWAIT, (struct sockaddr *)&from_sin, &from_len);
    if (r < 0) {
        return -1;
    }
    int64_t recv_us = now_monotonic_us();

    int pkt_seq = 0;
    if (!extract_echo_seq(rbuf, r, ICMP_ECHOREPLY, &pkt_seq)) {
        return 0;
    }
    if (pkt_seq < seq_min || pkt_seq > seq_max) {
        return 0;
    }

    char addr_str[INET_ADDRSTRLEN];
    addr_str[0] = '\0';
    if (from_sin.sin_family == AF_INET) {
        (void)inet_ntop(AF_INET, &from_sin.sin_addr, addr_str, sizeof(addr_str));
    }
    snprintf(out_buf, out_len, "REPLY|%d|%lld|%s", pkt_seq, (long long)recv_us, addr_str);
    return 1;
}

JNIEXPORT jint JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeOpenSocket(JNIEnv *env, jclass clazz) {
    (void)env;
    (void)clazz;

    int fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_ICMP);
    if (fd < 0) {
        int err = errno;
        return -(err > 0 ? err : EIO);
    }

    int flags = fcntl(fd, F_GETFL, 0);
    if (flags >= 0) {
        (void)fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    }

    int on = 1;
    if (setsockopt(fd, SOL_IP, IP_RECVERR, &on, sizeof(on)) < 0) {
        int err = errno;
        close(fd);
        return -(err > 0 ? err : EIO);
    }

    return (jint)fd;
}

JNIEXPORT void JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeCloseSocket(JNIEnv *env, jclass clazz, jint fd) {
    (void)env;
    (void)clazz;
    if (fd >= 0) {
        close((int)fd);
    }
}

JNIEXPORT void JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeDrainSocket(JNIEnv *env, jclass clazz, jint fd) {
    (void)env;
    (void)clazz;
    if (fd >= 0) {
        drain_socket((int)fd);
    }
}

JNIEXPORT jstring JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeErrnoMessage(JNIEnv *env, jclass clazz, jint errnum) {
    (void)clazz;
    const char *msg = strerror((int)errnum);
    if (!msg) {
        msg = "Socket error";
    }
    return (*env)->NewStringUTF(env, msg);
}

JNIEXPORT void JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeSetCancelled(JNIEnv *env, jclass clazz, jboolean cancelled) {
    (void)env;
    (void)clazz;
    atomic_store(&g_cancelled, cancelled ? 1 : 0);
}

JNIEXPORT jlong JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativeSendProbe(
    JNIEnv *env,
    jclass clazz,
    jint fd,
    jstring destIpJ,
    jint ttl,
    jint seq
) {
    (void)clazz;
    if (fd < 0 || destIpJ == NULL) {
        return -(jlong)EINVAL;
    }

    const char *destIpStr = (*env)->GetStringUTFChars(env, destIpJ, NULL);
    if (!destIpStr) {
        return -(jlong)ENOMEM;
    }

    struct sockaddr_in dest;
    memset(&dest, 0, sizeof(dest));
    dest.sin_family = AF_INET;
    int pton_ok = inet_pton(AF_INET, destIpStr, &dest.sin_addr);
    (*env)->ReleaseStringUTFChars(env, destIpJ, destIpStr);
    if (pton_ok != 1) {
        return -(jlong)EINVAL;
    }

    int ttl_val = (int)ttl;
    if (ttl_val < 1) ttl_val = 1;
    if (ttl_val > 255) ttl_val = 255;
    if (setsockopt((int)fd, SOL_IP, IP_TTL, &ttl_val, sizeof(ttl_val)) < 0) {
        int err = errno;
        return -(jlong)(err > 0 ? err : EIO);
    }

    uint8_t pkt[40];
    memset(pkt, 0, sizeof(pkt));
    uint16_t u_seq = (uint16_t)((uint32_t)seq & 0xFFFFU);
    pkt[0] = ICMP_ECHO;
    pkt[1] = 0;
    pkt[6] = (uint8_t)((u_seq >> 8) & 0xFFU);
    pkt[7] = (uint8_t)(u_seq & 0xFFU);
    for (size_t i = 8; i < sizeof(pkt); i++) {
        pkt[i] = (uint8_t)((i - 8) & 0xFFU);
    }
    uint16_t csum = compute_icmp_checksum(pkt, sizeof(pkt));
    pkt[2] = (uint8_t)((csum >> 8) & 0xFFU);
    pkt[3] = (uint8_t)(csum & 0xFFU);

    int last_err = EIO;
    for (int attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
            /* Clear any asynchronous ICMP error that set sk_err right before sendto(). */
            clear_sticky_socket_error((int)fd);
        }
        int64_t send_us = now_monotonic_us();
        ssize_t sent = sendto((int)fd, pkt, sizeof(pkt), 0, (struct sockaddr *)&dest, sizeof(dest));
        if (sent >= 0) {
            return (jlong)send_us;
        }
        last_err = errno > 0 ? errno : EIO;
        if (last_err == EBADF || last_err == EINVAL || last_err == EACCES || last_err == EPERM) {
            break;
        }
    }
    return -(jlong)last_err;
}

JNIEXPORT jstring JNICALL
Java_com_banzaigr_isubnet_TraceroutePlugin_nativePollProbe(
    JNIEnv *env,
    jclass clazz,
    jint fd,
    jint seqMin,
    jint seqMax,
    jint sliceMs
) {
    (void)clazz;
    char out_buf[128];

    if (atomic_load(&g_cancelled)) {
        return (*env)->NewStringUTF(env, "CANCELLED|||");
    }
    if (fd < 0) {
        return (*env)->NewStringUTF(env, "ERROR|0|9|");
    }

    int64_t deadline_us = now_monotonic_us() + (int64_t)sliceMs * 1000LL;

    while (1) {
        if (atomic_load(&g_cancelled)) {
            return (*env)->NewStringUTF(env, "CANCELLED|||");
        }

        while (1) {
            int r = read_one_errqueue((int)fd, (int)seqMin, (int)seqMax, out_buf, sizeof(out_buf));
            if (r == 1) {
                return (*env)->NewStringUTF(env, out_buf);
            }
            if (r < 0) {
                break;
            }
        }

        while (1) {
            int r = read_one_reply((int)fd, (int)seqMin, (int)seqMax, out_buf, sizeof(out_buf));
            if (r == 1) {
                return (*env)->NewStringUTF(env, out_buf);
            }
            if (r < 0) {
                break;
            }
        }

        int64_t rem_us = deadline_us - now_monotonic_us();
        if (rem_us <= 0) {
            return (*env)->NewStringUTF(env, "PENDING|||");
        }

        int wait_ms = (int)((rem_us + 999LL) / 1000LL);
        if (wait_ms > 25) {
            wait_ms = 25;
        }
        if (wait_ms < 1) {
            wait_ms = 1;
        }

        struct pollfd pfd;
        pfd.fd = (int)fd;
        pfd.events = POLLIN | POLLERR;
        pfd.revents = 0;

        int pr = poll(&pfd, 1, wait_ms);
        if (atomic_load(&g_cancelled)) {
            return (*env)->NewStringUTF(env, "CANCELLED|||");
        }
        if (pr < 0 && errno != EINTR) {
            snprintf(out_buf, sizeof(out_buf), "ERROR|0|%d|", errno);
            return (*env)->NewStringUTF(env, out_buf);
        }
    }
}
