import Foundation

public struct ServerConnectionConfiguration: Codable, Equatable, Sendable {
    public var baseURLString: String
    public var runtimeMode: RuntimeMode

    public init(
        baseURLString: String = "http://127.0.0.1:3100",
        runtimeMode: RuntimeMode = .hybrid
    ) {
        self.baseURLString = baseURLString
        self.runtimeMode = runtimeMode
    }

    public var trimmedBaseURLString: String {
        baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var apiBaseURL: URL? {
        guard var components = URLComponents(string: trimmedBaseURLString), components.scheme != nil else {
            return nil
        }

        if components.path.hasSuffix("/api") == false {
            let normalizedPath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            components.path = normalizedPath.isEmpty ? "/api" : "/\(normalizedPath)/api"
        }

        return components.url
    }

    public static let `default` = ServerConnectionConfiguration()
}

public struct ServerHealthSummary: Sendable {
    public var status: String
    public var version: String
    public var deploymentMode: String?
    public var deploymentExposure: String?

    public init(
        status: String,
        version: String,
        deploymentMode: String?,
        deploymentExposure: String?
    ) {
        self.status = status
        self.version = version
        self.deploymentMode = deploymentMode
        self.deploymentExposure = deploymentExposure
    }
}
