# attendance_fr package
"""
Attendance Face Recognition System.
Local development database compatibility patch:
Allows Django 6.1 to work with XAMPP's MariaDB 10.4.32 or MySQL 8.4
without triggering NotSupportedError or MariaDB 10.4 RETURNING syntax errors.
In production with TiDB Cloud, this maintains seamless compatibility.
"""
try:
    from django.db.backends.base.base import BaseDatabaseWrapper
    from django.db.backends.mysql.features import DatabaseFeatures

    _original_check_database_version_supported = BaseDatabaseWrapper.check_database_version_supported

    def _safe_check_database_version_supported(self):
        try:
            _original_check_database_version_supported(self)
        except Exception:
            # Bypass strict minimum version check on local environments
            pass

    BaseDatabaseWrapper.check_database_version_supported = _safe_check_database_version_supported

    # MariaDB 10.4 does not support INSERT ... RETURNING (added in 10.5)
    # MySQL and TiDB also do not use INSERT ... RETURNING
    DatabaseFeatures.can_return_columns_from_insert = False

except ImportError:
    pass
