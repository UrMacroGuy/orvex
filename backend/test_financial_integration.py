"""Quick integration test for financial module."""
from __future__ import annotations

import asyncio
import sys

# Test imports
try:
    from app.financial.base import BaseFinancialProvider
    from app.financial.finnhub import FinnhubProvider
    from app.financial.polygon import PolygonProvider
    from app.financial.alpha_vantage import AlphaVantageProvider
    from app.financial.fmp import FMPProvider
    from app.providers.registry import ProviderRegistry as FinancialProviderRegistry, registry
    from app.services.financial_service import FinancialService
    from app.schemas.financial import QuoteData, CompanyProfile, EarningsData
    print("[OK] All imports successful")
except ImportError as e:
    print(f"[ERROR] Import error: {e}")
    sys.exit(1)


async def test_registry():
    """Test provider registry."""
    print("\n=== Testing Provider Registry ===")

    providers = registry.ids()
    print(f"Available providers: {providers}")

    expected = ["finnhub", "polygon", "alpha_vantage", "fmp"]
    for provider_id in expected:
        if provider_id in providers:
            print(f"[OK] Provider '{provider_id}' registered")
        else:
            print(f"[ERROR] Provider '{provider_id}' not found")
            return False

    return True


async def test_provider_instantiation():
    """Test provider instantiation."""
    print("\n=== Testing Provider Instantiation ===")

    test_key = "test_api_key"

    providers_to_test = [
        ("finnhub", FinnhubProvider),
        ("polygon", PolygonProvider),
        ("alpha_vantage", AlphaVantageProvider),
        ("fmp", FMPProvider),
    ]

    for provider_name, provider_class in providers_to_test:
        try:
            provider = provider_class(test_key)
            print(f"[OK] {provider_name}: instantiated successfully")
            print(f"  - ID: {provider.id}")
            print(f"  - Display name: {provider.display_name}")
        except Exception as e:
            print(f"[ERROR] {provider_name}: {e}")
            return False

    return True


async def test_financial_service():
    """Test financial service instantiation."""
    print("\n=== Testing Financial Service ===")

    try:
        service = FinancialService()
        print("[OK] FinancialService instantiated")

        providers = service.list_available_providers()
        print(f"[OK] Available providers: {providers}")

        return True
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False


async def test_schema_validation():
    """Test schema validation."""
    print("\n=== Testing Schema Validation ===")

    try:
        from datetime import datetime

        quote = QuoteData(
            symbol="AAPL",
            company_name="Apple Inc.",
            current_price=150.0,
            previous_close=148.5,
            open_price=149.0,
            high_price=151.5,
            low_price=147.5,
            change_amount=1.5,
            change_percent=1.01,
            volume=1000000,
            timestamp=datetime.now(),
        )
        print(f"[OK] QuoteData schema valid: {quote.symbol}")

        profile = CompanyProfile(
            symbol="AAPL",
            name="Apple Inc.",
            description="Technology company",
            sector="Technology",
            industry="Consumer Electronics",
            website="https://apple.com",
            employees=161000,
            market_cap=3_000_000_000_000,
            pe_ratio=28.5,
        )
        print(f"[OK] CompanyProfile schema valid: {profile.symbol}")

        earnings = EarningsData(
            symbol="AAPL",
            report_date="2024-01-30",
            fiscal_date="2024-Q1",
            eps_actual=2.18,
            eps_estimate=2.10,
        )
        print(f"[OK] EarningsData schema valid: {earnings.symbol}")

        return True
    except Exception as e:
        print(f"[ERROR] Schema validation error: {e}")
        return False


async def main():
    """Run all tests."""
    print("=" * 50)
    print("Financial Module Integration Test")
    print("=" * 50)

    tests = [
        ("Registry", test_registry),
        ("Provider Instantiation", test_provider_instantiation),
        ("Financial Service", test_financial_service),
        ("Schema Validation", test_schema_validation),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n[ERROR] Test '{test_name}' failed with exception: {e}")
            results.append((test_name, False))

    print("\n" + "=" * 50)
    print("Test Summary")
    print("=" * 50)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "[OK] PASS" if result else "[ERROR] FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    return all(result for _, result in results)


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
