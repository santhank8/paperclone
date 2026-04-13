"""Tests for thread-safe skill cache."""

import threading

from deerflow.skills.loader import (
    get_cached_skills,
    invalidate_skills_cache,
    _skills_cache_version,
)


class TestSkillCache:
    def test_get_cached_skills_returns_list(self):
        invalidate_skills_cache()
        skills = get_cached_skills()
        assert isinstance(skills, list)

    def test_cache_returns_same_list_on_second_call(self):
        invalidate_skills_cache()
        skills1 = get_cached_skills()
        skills2 = get_cached_skills()
        assert skills1 is skills2  # Same object reference = cached

    def test_invalidate_forces_refresh(self):
        invalidate_skills_cache()
        skills1 = get_cached_skills()
        invalidate_skills_cache()
        skills2 = get_cached_skills()
        assert skills1 is not skills2  # Different objects after invalidation

    def test_version_increments_on_refresh(self):
        invalidate_skills_cache()
        get_cached_skills()  # populate
        v1 = _skills_cache_version()
        invalidate_skills_cache()
        get_cached_skills()  # re-populate
        v2 = _skills_cache_version()
        assert v2 > v1

    def test_thread_safe_access(self):
        """Multiple threads can access cache without errors."""
        invalidate_skills_cache()
        results = []
        errors = []

        def worker():
            try:
                skills = get_cached_skills()
                results.append(len(skills))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert len(results) == 10
