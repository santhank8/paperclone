"""PathMapping dataclass for sandbox path resolution.

Replaces dict[str, str] path mappings with a structured dataclass
that supports read-only flags and custom mounts from config.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PathMapping:
    """Maps a container path to a local filesystem path.

    Attributes:
        container_path: Virtual path visible to the agent (e.g., /mnt/user-data).
        local_path: Physical path on the host.
        read_only: If True, write operations to this mount are blocked.
    """

    container_path: str
    local_path: str
    read_only: bool = False

    @property
    def is_writable(self) -> bool:
        """Whether this mapping allows writes."""
        return not self.read_only

    def resolve(self, path: str) -> str | None:
        """Resolve a container path to local path.

        Args:
            path: The path to resolve.

        Returns:
            The local path if container_path is a prefix, None otherwise.
        """
        if path == self.container_path or path.startswith(self.container_path + "/"):
            return self.local_path + path[len(self.container_path) :]
        return None


def resolve_path(path: str, mappings: list[PathMapping]) -> str:
    """Resolve a path using a list of PathMappings.

    Returns the first match, or the original path if no mapping matches.
    """
    for mapping in mappings:
        resolved = mapping.resolve(path)
        if resolved is not None:
            return resolved
    return path


def check_writable(path: str, mappings: list[PathMapping]) -> bool:
    """Check if a path is writable given the current mappings.

    Returns True if the path matches a writable mapping or no mapping at all.
    Returns False if the path matches a read-only mapping.
    """
    for mapping in mappings:
        if mapping.resolve(path) is not None:
            return mapping.is_writable
    return True  # No mapping = no restriction
