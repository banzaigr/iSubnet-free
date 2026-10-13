import UIKit
import Capacitor

public class PingBridgeViewController: CAPBridgeViewController {
    override public func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(PingPlugin())
    }
}
