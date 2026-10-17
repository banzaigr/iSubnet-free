import UIKit
import Capacitor

public class PingBridgeViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        let ping = PingPlugin()
        bridge?.registerPluginInstance(ping)
        ping.observeAppBackground()
        let traceroute = TraceroutePlugin()
        bridge?.registerPluginInstance(traceroute)
        traceroute.observeAppBackground()
    }
}
