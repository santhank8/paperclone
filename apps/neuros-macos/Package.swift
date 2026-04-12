// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "neurOS-macos",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "NeurOSAppCore", targets: ["NeurOSAppCore"]),
        .library(name: "NeurOSDesktopServices", targets: ["NeurOSDesktopServices"]),
        .library(name: "NeurOSDesktopFeatures", targets: ["NeurOSDesktopFeatures"]),
        .executable(name: "NeurOSDesktopApp", targets: ["NeurOSDesktopApp"]),
    ],
    targets: [
        .target(
            name: "NeurOSAppCore"
        ),
        .target(
            name: "NeurOSDesktopServices",
            dependencies: ["NeurOSAppCore"]
        ),
        .target(
            name: "NeurOSDesktopFeatures",
            dependencies: [
                "NeurOSAppCore",
                "NeurOSDesktopServices",
            ],
            resources: [
                .process("Resources"),
            ]
        ),
        .executableTarget(
            name: "NeurOSDesktopApp",
            dependencies: [
                "NeurOSAppCore",
                "NeurOSDesktopFeatures",
                "NeurOSDesktopServices",
            ]
        ),
    ]
)
