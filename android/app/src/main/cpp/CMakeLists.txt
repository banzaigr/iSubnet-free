cmake_minimum_required(VERSION 3.18.1)
project("isubnet_traceroute" C)

add_library(isubnet_traceroute SHARED
    traceroute_jni.c
)

target_compile_options(isubnet_traceroute PRIVATE -Wall -Wextra -O2)
target_link_options(isubnet_traceroute PRIVATE "-Wl,-z,max-page-size=16384")

find_library(log-lib log)
target_link_libraries(isubnet_traceroute ${log-lib})
