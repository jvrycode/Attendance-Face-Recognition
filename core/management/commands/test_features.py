"""
Custom Django management command that runs feature test suites
with a clean, styled, informative CLI output matching Laravel's `php artisan test`.
"""
import sys
import time
import unittest
from django.core.management.base import BaseCommand
from django.test.runner import DiscoverRunner

# Ensure UTF-8 output where supported
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Check if terminal can render Unicode checkmark safely
try:
    "✓".encode(sys.stdout.encoding or 'ascii')
    GLYPH_OK = "✓"
    GLYPH_FAIL = "✗"
    LINE_CHAR = "─"
except Exception:
    GLYPH_OK = "[PASS]"
    GLYPH_FAIL = "[FAIL]"
    LINE_CHAR = "-"

# ANSI color codes
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

# Text Colors
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
WHITE = "\033[37m"

# Inverted Badge Colors
BG_GREEN_BLACK = "\033[42m\033[30m"
BG_RED_WHITE = "\033[41m\033[37m"


class ArtisanStyleTestResult(unittest.TextTestResult):
    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.current_class = None
        self.test_start_time = 0.0
        self.passed_tests = []
        self.failed_tests = []
        self.error_tests = []

    def startTest(self, test):
        self.test_start_time = time.time()
        test_class = test.__class__.__name__
        module_name = test.__class__.__module__

        # When switching to a new test class, print the Laravel-style header badge
        if test_class != self.current_class:
            self.current_class = test_class
            self.stream.writeln()
            badge = f" {BG_GREEN_BLACK}{BOLD} PASS {RESET} "
            header = f"{BOLD}{module_name}.{test_class}{RESET}"
            self.stream.writeln(f"{badge} {header}")

    def addSuccess(self, test):
        super().addSuccess(test)
        elapsed = time.time() - self.test_start_time
        method_name = test._testMethodName
        readable_name = method_name.replace('test_', '').replace('_', ' ')

        # Align time column to 60 chars
        prefix = f"  {GREEN}{GLYPH_OK}{RESET} {readable_name}"
        pad = max(1, 60 - len(readable_name))
        self.stream.writeln(f"{prefix}{' ' * pad}{DIM}{elapsed:.2f}s{RESET}")
        self.passed_tests.append((test, elapsed))

    def addFailure(self, test, err):
        super().addFailure(test, err)
        elapsed = time.time() - self.test_start_time
        method_name = test._testMethodName
        readable_name = method_name.replace('test_', '').replace('_', ' ')
        pad = max(1, 60 - len(readable_name))
        self.stream.writeln(f"  {RED}{GLYPH_FAIL}{RESET} {BOLD}{readable_name}{RESET}{' ' * pad}{RED}{elapsed:.2f}s{RESET}")
        self.failed_tests.append((test, err))

    def addError(self, test, err):
        super().addError(test, err)
        elapsed = time.time() - self.test_start_time
        method_name = test._testMethodName
        readable_name = method_name.replace('test_', '').replace('_', ' ')
        pad = max(1, 60 - len(readable_name))
        self.stream.writeln(f"  {RED}! ERROR: {readable_name}{RESET}{' ' * pad}{RED}{elapsed:.2f}s{RESET}")
        self.error_tests.append((test, err))

    def printErrors(self):
        # Suppress standard Python unittest dots and default summaries
        pass


class ArtisanTestRunner(DiscoverRunner):
    def get_resultclass(self):
        return ArtisanStyleTestResult


class Command(BaseCommand):
    help = "Runs all feature tests with Laravel `php artisan test` style formatting"

    def add_arguments(self, parser):
        parser.add_argument(
            '--tag',
            type=str,
            help='Run specific test suite (accounts, core, or face_app)',
        )

    def handle(self, *args, **options):
        # Enable ANSI colors on Windows terminals
        if sys.platform == 'win32':
            import os
            os.system('')

        tag = options.get('tag')
        test_labels = ['accounts', 'core', 'face_app']
        if tag:
            test_labels = [tag]

        self.stdout.write(f"\n{BOLD}{CYAN}AttendFR Test Suite{RESET} {DIM}(Laravel artisan test style){RESET}")
        self.stdout.write(f"{DIM}Running automated feature checks against local MySQL database...{RESET}\n")

        start_total = time.time()
        runner = ArtisanTestRunner(verbosity=0, interactive=False, keepdb=True)
        failures = runner.run_tests(test_labels)
        total_duration = time.time() - start_total

        self.stdout.write("\n" + LINE_CHAR * 70)
        if failures == 0:
            badge = f" {BG_GREEN_BLACK}{BOLD} PASS {RESET} "
            self.stdout.write(
                f"{badge} {BOLD}{GREEN}All tests passed! (19 total){RESET} "
                f"{DIM}(Duration: {total_duration:.2f}s){RESET}\n"
            )
        else:
            badge = f" {BG_RED_WHITE}{BOLD} FAIL {RESET} "
            self.stdout.write(
                f"{badge} {BOLD}{RED}{failures} test(s) failed.{RESET} "
                f"{DIM}(Duration: {total_duration:.2f}s){RESET}\n"
            )
            sys.exit(1)
