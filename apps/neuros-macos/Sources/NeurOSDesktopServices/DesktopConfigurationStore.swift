import Foundation
import NeurOSAppCore

public protocol DesktopConfigurationStoring: Sendable {
    func load() async -> ServerConnectionConfiguration
    func save(_ configuration: ServerConnectionConfiguration) async
}

public actor UserDefaultsDesktopConfigurationStore: DesktopConfigurationStoring {
    private let defaults: UserDefaults
    private let key = "io.goldneuron.neurOS.desktop-configuration"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func load() async -> ServerConnectionConfiguration {
        guard
            let data = defaults.data(forKey: key),
            let configuration = try? decoder.decode(ServerConnectionConfiguration.self, from: data)
        else {
            return .default
        }

        return configuration
    }

    public func save(_ configuration: ServerConnectionConfiguration) async {
        guard let data = try? encoder.encode(configuration) else { return }
        defaults.set(data, forKey: key)
    }
}
