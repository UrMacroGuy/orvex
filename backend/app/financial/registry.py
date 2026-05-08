from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class EntityProfile:
    ticker: str
    company_name: str
    sector: str
    country: str
    macro_drivers: List[str]
    keywords: List[str]


# Canonical profiles for entities where strict grounding matters most.
# For unlisted tickers the pipeline falls back to dynamic resolution via Yahoo search.
_CANONICAL: Dict[str, EntityProfile] = {
    # ── INDIA ─────────────────────────────────────────────────────────────────
    "VEDL": EntityProfile(
        ticker="VEDL", company_name="Vedanta Ltd",
        sector="Metals & Mining", country="India",
        macro_drivers=["Commodity Cycles", "Energy Prices", "Infrastructure Spending", "China Demand"],
        keywords=["zinc", "aluminium", "copper", "iron ore", "dividends", "promoter debt", "Hindustan Zinc"],
    ),
    "RELIANCE": EntityProfile(
        ticker="RELIANCE", company_name="Reliance Industries",
        sector="Conglomerate", country="India",
        macro_drivers=["Retail Expansion", "Telecom Growth", "Oil Refining Margins", "Green Energy Capex"],
        keywords=["Jio", "retail", "petrochemicals", "refinery", "new energy", "5G"],
    ),
    "ADANIENT": EntityProfile(
        ticker="ADANIENT", company_name="Adani Enterprises",
        sector="Diversified Industrials", country="India",
        macro_drivers=["Infrastructure Spending", "Renewable Energy", "Ports & Logistics", "Government Contracts"],
        keywords=["airports", "solar", "coal", "green hydrogen", "ports", "logistics"],
    ),
    "TATAPOWER": EntityProfile(
        ticker="TATAPOWER", company_name="Tata Power",
        sector="Utilities", country="India",
        macro_drivers=["Renewable Energy Transition", "India Power Demand", "EV Charging", "Solar Policy"],
        keywords=["solar", "renewables", "power distribution", "EV charging", "coal phaseout"],
    ),
    "TATAMOTORS": EntityProfile(
        ticker="TATAMOTORS", company_name="Tata Motors",
        sector="Automotive", country="India",
        macro_drivers=["EV Adoption", "Jaguar Land Rover", "India Auto Cycle", "Commodity Costs"],
        keywords=["JLR", "electric vehicles", "trucks", "passenger vehicles", "EV", "Nexon"],
    ),
    "INFY": EntityProfile(
        ticker="INFY", company_name="Infosys Ltd",
        sector="Information Technology", country="India",
        macro_drivers=["Global IT Spending", "USD/INR Rate", "AI Adoption", "Client Budget Cycles"],
        keywords=["IT services", "consulting", "digital transformation", "cloud", "AI", "outsourcing"],
    ),
    "TCS": EntityProfile(
        ticker="TCS", company_name="Tata Consultancy Services",
        sector="Information Technology", country="India",
        macro_drivers=["Global IT Spending", "USD/INR Rate", "AI Transformation", "BFSI Client Trends"],
        keywords=["IT services", "consulting", "BFSI", "digital", "cloud", "AI"],
    ),
    "HDFCBANK": EntityProfile(
        ticker="HDFCBANK", company_name="HDFC Bank",
        sector="Banking & Financial Services", country="India",
        macro_drivers=["RBI Policy", "Credit Growth", "India GDP", "NPA Cycles", "Retail Lending"],
        keywords=["NII", "NPA", "CASA ratio", "retail banking", "credit card", "mortgage"],
    ),
    "ONGC": EntityProfile(
        ticker="ONGC", company_name="Oil and Natural Gas Corporation",
        sector="Energy", country="India",
        macro_drivers=["Crude Oil Prices", "India Energy Policy", "Subsidy Burden", "Exploration Capex"],
        keywords=["crude oil", "natural gas", "exploration", "PSU", "subsidy", "upstream"],
    ),

    # ── USA ───────────────────────────────────────────────────────────────────
    "NVDA": EntityProfile(
        ticker="NVDA", company_name="NVIDIA Corporation",
        sector="Technology", country="USA",
        macro_drivers=["AI Capex", "Semiconductor Cycle", "Cloud Demand", "Hyperscaler Spending"],
        keywords=["GPU", "Data Center", "AI", "Gaming", "Chips", "Compute", "H100", "Blackwell"],
    ),
    "AAPL": EntityProfile(
        ticker="AAPL", company_name="Apple Inc",
        sector="Technology", country="USA",
        macro_drivers=["Consumer Spending", "iPhone Upgrade Cycle", "Services Growth", "China Demand"],
        keywords=["iPhone", "Mac", "iPad", "services", "App Store", "Vision Pro", "wearables"],
    ),
    "MSFT": EntityProfile(
        ticker="MSFT", company_name="Microsoft Corporation",
        sector="Technology", country="USA",
        macro_drivers=["Cloud Capex", "AI Adoption", "Enterprise IT Spend", "Azure Growth"],
        keywords=["Azure", "Office 365", "Copilot", "Teams", "cloud", "gaming", "AI"],
    ),
    "GOOGL": EntityProfile(
        ticker="GOOGL", company_name="Alphabet Inc",
        sector="Technology", country="USA",
        macro_drivers=["Digital Advertising", "Cloud Growth", "AI Competition", "Regulatory Risk"],
        keywords=["Google Search", "YouTube", "GCP", "AI Overviews", "advertising", "Gemini"],
    ),
    "AMZN": EntityProfile(
        ticker="AMZN", company_name="Amazon.com Inc",
        sector="Consumer Discretionary / Technology", country="USA",
        macro_drivers=["Consumer Spending", "AWS Cloud Demand", "Advertising Growth", "Logistics Efficiency"],
        keywords=["AWS", "Prime", "advertising", "logistics", "e-commerce", "AI", "Bedrock"],
    ),
    "META": EntityProfile(
        ticker="META", company_name="Meta Platforms Inc",
        sector="Technology", country="USA",
        macro_drivers=["Digital Advertising", "Metaverse Investment", "AI Infrastructure", "Regulatory Risk"],
        keywords=["Facebook", "Instagram", "WhatsApp", "Reels", "AI", "llama", "VR", "advertising"],
    ),
    "TSLA": EntityProfile(
        ticker="TSLA", company_name="Tesla Inc",
        sector="Automotive / Energy", country="USA",
        macro_drivers=["EV Adoption", "Battery Costs", "Autonomous Driving", "Energy Storage", "China Competition"],
        keywords=["Model 3", "Model Y", "Cybertruck", "FSD", "Gigafactory", "energy storage", "Optimus"],
    ),
    "JPM": EntityProfile(
        ticker="JPM", company_name="JPMorgan Chase & Co",
        sector="Banking", country="USA",
        macro_drivers=["Fed Rate Policy", "Credit Cycle", "Investment Banking Activity", "Consumer Credit"],
        keywords=["NII", "investment banking", "credit cards", "mortgage", "commercial banking", "trading"],
    ),
    "XOM": EntityProfile(
        ticker="XOM", company_name="ExxonMobil Corporation",
        sector="Energy", country="USA",
        macro_drivers=["Crude Oil Prices", "Natural Gas Demand", "Energy Transition", "Refining Margins"],
        keywords=["upstream", "downstream", "refining", "LNG", "Permian Basin", "Pioneer", "carbon capture"],
    ),
    "BRK-B": EntityProfile(
        ticker="BRK-B", company_name="Berkshire Hathaway",
        sector="Diversified", country="USA",
        macro_drivers=["Insurance Cycle", "Equity Market Returns", "Interest Rates", "US Economic Health"],
        keywords=["Buffett", "insurance", "BNSF", "Geico", "operating earnings", "cash reserves"],
    ),
    "GS": EntityProfile(
        ticker="GS", company_name="Goldman Sachs Group Inc",
        sector="Investment Banking", country="USA",
        macro_drivers=["M&A Activity", "IPO Market", "Trading Volatility", "Fed Rate Path"],
        keywords=["investment banking", "trading", "M&A", "asset management", "Marcus", "FICC"],
    ),

    # ── GLOBAL MINING & COMMODITIES ───────────────────────────────────────────
    "RIO": EntityProfile(
        ticker="RIO", company_name="Rio Tinto",
        sector="Metals & Mining", country="Australia/UK",
        macro_drivers=["Iron Ore Prices", "China Steel Demand", "Copper Demand", "Energy Transition Metals"],
        keywords=["iron ore", "copper", "aluminium", "lithium", "Pilbara", "Mongolia"],
    ),
    "BHP": EntityProfile(
        ticker="BHP", company_name="BHP Group",
        sector="Metals & Mining", country="Australia/UK",
        macro_drivers=["Iron Ore Prices", "Copper Demand", "Coal Markets", "China Demand"],
        keywords=["iron ore", "copper", "coal", "nickel", "Pilbara", "Chile"],
    ),
    "FCX": EntityProfile(
        ticker="FCX", company_name="Freeport-McMoRan Inc",
        sector="Metals & Mining", country="USA",
        macro_drivers=["Copper Demand", "EV Transition", "Indonesia Operations", "China Demand"],
        keywords=["copper", "gold", "Grasberg", "Indonesia", "Arizona", "mining"],
    ),

    # ── EUROPE ────────────────────────────────────────────────────────────────
    "ASML": EntityProfile(
        ticker="ASML", company_name="ASML Holding NV",
        sector="Semiconductor Equipment", country="Netherlands",
        macro_drivers=["Semiconductor Capex Cycle", "AI Chip Demand", "China Export Restrictions", "EUV Adoption"],
        keywords=["EUV", "lithography", "semiconductor equipment", "TSMC", "Samsung", "Intel Foundry"],
    ),
    "SAP": EntityProfile(
        ticker="SAP", company_name="SAP SE",
        sector="Enterprise Software", country="Germany",
        macro_drivers=["Enterprise IT Spend", "Cloud Migration", "AI Integration", "ERP Market"],
        keywords=["ERP", "cloud", "S/4HANA", "Joule", "enterprise software"],
    ),

    # ── CHINA ─────────────────────────────────────────────────────────────────
    "BABA": EntityProfile(
        ticker="BABA", company_name="Alibaba Group",
        sector="E-Commerce / Technology", country="China",
        macro_drivers=["China Consumer Spending", "Cloud Growth", "Regulatory Environment", "USD/CNY"],
        keywords=["e-commerce", "Taobao", "Tmall", "Aliyun", "AI", "Ant Group", "logistics"],
    ),
    "BIDU": EntityProfile(
        ticker="BIDU", company_name="Baidu Inc",
        sector="Technology", country="China",
        macro_drivers=["China AI Policy", "Digital Advertising", "Autonomous Driving", "Regulatory Risk"],
        keywords=["search", "Ernie Bot", "AI", "autonomous driving", "cloud", "advertising"],
    ),

    # ── ENERGY ───────────────────────────────────────────────────────────────
    "CVX": EntityProfile(
        ticker="CVX", company_name="Chevron Corporation",
        sector="Energy", country="USA",
        macro_drivers=["Crude Oil Prices", "LNG Demand", "Energy Transition", "Permian Basin"],
        keywords=["upstream", "downstream", "LNG", "Permian", "refining", "Hess"],
    ),
    "SLB": EntityProfile(
        ticker="SLB", company_name="Schlumberger NV",
        sector="Oilfield Services", country="USA",
        macro_drivers=["E&P Spending", "Oil Price Cycle", "International Drilling", "Deepwater"],
        keywords=["oilfield services", "drilling", "completions", "digital oilfield", "international"],
    ),

    # ── PHARMA ───────────────────────────────────────────────────────────────
    "LLY": EntityProfile(
        ticker="LLY", company_name="Eli Lilly and Company",
        sector="Pharmaceuticals", country="USA",
        macro_drivers=["GLP-1 Demand", "Drug Pricing Policy", "Obesity Treatment Market", "Pipeline Risk"],
        keywords=["Mounjaro", "Zepbound", "GLP-1", "Tirzepatide", "Alzheimer", "oncology"],
    ),
    "PFE": EntityProfile(
        ticker="PFE", company_name="Pfizer Inc",
        sector="Pharmaceuticals", country="USA",
        macro_drivers=["Drug Pricing Reform", "Vaccine Market", "Pipeline Success Rate", "Patent Cliff"],
        keywords=["COVID vaccine", "oncology", "patent cliff", "Paxlovid", "Seagen"],
    ),
}


class EntityRegistry:
    def __init__(self) -> None:
        self._registry: Dict[str, EntityProfile] = {**_CANONICAL}

    def get_entity(self, ticker: str) -> Optional[EntityProfile]:
        return self._registry.get(ticker.upper())

    def register(self, profile: EntityProfile) -> None:
        self._registry[profile.ticker.upper()] = profile

    def search_entity(self, query: str) -> Optional[EntityProfile]:
        upper = query.upper()
        direct = self._registry.get(upper)
        if direct:
            return direct
        # Fuzzy fallback: match on company name
        lower_query = query.lower()
        for profile in self._registry.values():
            if lower_query in profile.company_name.lower():
                return profile
        return None


registry = EntityRegistry()
