import UIKit
import Capacitor

public class PingBridgeViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        let ping = PingPlugin()
        bridge?.registerPluginInstance(ping)
        ping.observeAppBackground()
    }
}
