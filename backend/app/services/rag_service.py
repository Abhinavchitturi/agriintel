import os
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
import faiss

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RAGChunk:
    id: int
    text: str
    metadata: Dict[str, Any]
    embedding: Optional[np.ndarray] = None


@dataclass
class RAGResult:
    answer: str
    sources: List[Dict[str, Any]]
    confidence: float
    chunks_used: int


CROP_KNOWLEDGE_BASE = [
    # Rice
    {
        "crop": "rice", "category": "cereal", "season": "kharif",
        "text": """Rice (Oryza sativa) - Kharif Season Crop
        Optimal Conditions: Temperature 25-30°C, Humidity 70-90%, Rainfall 1000-1500mm
        Sowing: June-July (transplant 21-25 day seedlings)
        Duration: 120-150 days depending on variety
        Water: Maintain 2-5cm standing water until maturity
        Soil: pH 5.5-7.0, clay loam preferred
        Fertilizer (kg/ha): N 100-120 (50% basal, 25% tillering, 25% panicle initiation), P2O5 50-60, K2O 40-50
        ZnSO4 25 kg/ha if deficient
        Key Varieties: Basmati (PB 1121, PB 1509), Non-Basmati (PR 126, PR 131, Pusa 44)
        Pests: Stem borer, Leaf folder, Brown planthopper, Gall midge
        Diseases: Blast, Bacterial blight, Sheath blight, Tungro virus
        Harvest: 25-30 days after flowering when moisture 20-25%""",
        "months": [6, 7, 8, 9, 10, 11]
    },
    {
        "crop": "rice", "category": "cereal", "season": "rabi",
        "text": """Rice - Rabi/Boro Season (Assured Irrigation Areas)
        Sowing: November-December, Transplant: December-January
        Duration: 140-160 days, Harvest: April-May
        Water: Critical - needs assured irrigation throughout
        Temperature: 15-25°C during vegetative, 25-30°C reproductive
        Varieties: IR 64, MTU 1010, Swarna, CR 1009
        Fertilizer: N 120-150, P2O5 60-80, K2O 50-60 kg/ha""",
        "months": [11, 12, 1, 2, 3, 4, 5]
    },
    
    # Wheat
    {
        "crop": "wheat", "category": "cereal", "season": "rabi",
        "text": """Wheat (Triticum aestivum) - Rabi Season Crop
        Optimal Conditions: Temperature 12-25°C, Humidity 50-70%, Rainfall 300-500mm
        Sowing: November 15 - December 15 (timely), up to Dec 31 (late)
        Duration: 120-140 days, Harvest: March-April
        Soil: pH 6.0-7.5, well-drained loam
        Irrigation: 4-6 irrigations (CRI 21 DAS, Tillering 45, Jointing 60, Flowering 75, Grain fill 90)
        Fertilizer (kg/ha): N 120-150 (50% basal, 25% CRI, 25% jointing), P2O5 60-80, K2O 40-60
        ZnSO4 25 kg/ha, FeSO4 if deficient
        Key Varieties: HD 3086, DBW 187, PBW 725, WH 1105, HI 1605
        Pests: Aphids, Termites, Armyworm
        Diseases: Yellow rust, Brown rust, Karnal bunt, Loose smut
        Harvest: When grain moisture 12-14%""",
        "months": [11, 12, 1, 2, 3, 4]
    },
    
    # Maize
    {
        "crop": "maize", "category": "cereal", "season": "kharif",
        "text": """Maize (Zea mays) - Kharif Season
        Optimal: Temperature 25-30°C, Rainfall 500-800mm
        Sowing: June-July, Duration: 90-110 days, Harvest: September-October
        Spacing: 60x20 cm, Seed rate: 20-25 kg/ha
        Fertilizer: N 150-180, P2O5 70-80, K2O 60-70 kg/ha
        Varieties: PMH 1, PMH 2, HQPM 1, DHM 117 (hybrids)
        Water: Critical at tasseling and silking""",
        "months": [6, 7, 8, 9, 10]
    },
    {
        "crop": "maize", "category": "cereal", "season": "rabi",
        "text": """Maize - Rabi Season (with irrigation)
        Sowing: October-November, Duration: 100-120 days, Harvest: February-March
        Temperature: 15-25°C ideal, Frost sensitive
        Higher yield potential in rabi due to better sunshine""",
        "months": [10, 11, 12, 1, 2, 3]
    },
    
    # Cotton
    {
        "crop": "cotton", "category": "fiber", "season": "kharif",
        "text": """Cotton (Gossypium hirsutum) - Kharif Crop
        Optimal: Temperature 25-35°C, Rainfall 500-800mm
        Sowing: April-May (North), June-July (Central), Aug-Sep (South)
        Duration: 160-180 days, Harvest: October-February (picking)
        Spacing: 90x60 cm (hybrids), 60x30 cm (varieties)
        Fertilizer: N 150-200, P2O5 75-100, K2O 75-100 kg/ha
        MgSO4 20 kg/ha if deficient
        Key Hybrids: BG II, BG III (Bt), Non-Bt: NH 615, Suraj, PKV 081
        Pests: Pink bollworm, American bollworm, Aphids, Jassids, Whitefly, Thrips
        Diseases: Bacterial blight, Alternaria, Grey mildew, Root rot
        IPM: Refuge crop, Pheromone traps, Neem-based sprays, Timely termination""",
        "months": [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]
    },
    
    # Soybean
    {
        "crop": "soybean", "category": "oilseed", "season": "kharif",
        "text": """Soybean (Glycine max) - Kharif Oilseed
        Optimal: Temperature 25-30°C, Rainfall 600-1000mm
        Sowing: June-July, Duration: 90-110 days, Harvest: September-October
        Spacing: 45x5 cm, Seed rate: 60-75 kg/ha
        Fertilizer: N 20-30 (starter), P2O5 60-80, K2O 40-50 kg/ha
        Rhizobium + PSB seed treatment essential
        Varieties: JS 335, JS 9560, NRC 37, MACS 450
        Pests: Stem fly, Girdle beetle, Semilooper, Spodoptera
        Diseases: Yellow mosaic, Rhizoctonia, Charcoal rot""",
        "months": [6, 7, 8, 9, 10]
    },
    
    # Groundnut
    {
        "crop": "groundnut", "category": "oilseed", "season": "kharif",
        "text": """Groundnut (Arachis hypogaea) - Kharif
        Optimal: Temperature 25-30°C, Rainfall 500-750mm, Well-drained sandy loam
        Sowing: June-July, Duration: 100-120 days, Harvest: October-November
        Spacing: 30x10 cm, Seed rate: 100-120 kg/ha (kernels)
        Fertilizer: N 20-30, P2O5 40-50, K2O 40-50 kg/ha + Gypsum 500 kg/ha at pegging
        Rhizobium + PSB inoculation
        Varieties: GG 20, GG 21, TG 37A, Kadiri 6, ICGV 91114
        Pests: Leaf miner, Spodoptera, Thrips, Aphids
        Diseases: Tikka leaf spot, Rust, Collar rot, Aflatoxin""",
        "months": [6, 7, 8, 9, 10, 11]
    },
    
    # Mustard
    {
        "crop": "mustard", "category": "oilseed", "season": "rabi",
        "text": """Mustard (Brassica juncea) - Rabi Oilseed
        Optimal: Temperature 15-25°C, Rainfall 300-400mm
        Sowing: October-November, Duration: 110-130 days, Harvest: February-March
        Spacing: 45x15 cm, Seed rate: 4-5 kg/ha
        Fertilizer: N 80-100, P2O5 40-50, K2O 30-40 kg/ha + S 20-30 kg/ha
        Varieties: RH 749, RH 725, DRMR 150-35, Pusa Bold
        Pests: Aphids, Sawfly, Painted bug
        Diseases: Alternaria blight, White rust, Downy mildew""",
        "months": [10, 11, 12, 1, 2, 3]
    },
    
    # Sugarcane
    {
        "crop": "sugarcane", "category": "cash", "season": "annual",
        "text": """Sugarcane (Saccharum officinarum) - Annual Crop
        Planting: Spring (Feb-Mar), Autumn (Oct-Nov), Adsali (Jul-Aug)
        Duration: 10-18 months depending on planting season
        Optimal: Temperature 26-32°C, Rainfall 1000-1500mm
        Spacing: 90-120 cm rows, 2-3 budded setts
        Fertilizer: N 250-300, P2O5 100-120, K2O 150-200 kg/ha (split 4-5 times)
        Varieties: Co 0238, Co 0239, Co 86032, Co 0118, Co 05011
        Pests: Early shoot borer, Top borer, Stalk borer, Pyrilla, Whitefly
        Diseases: Red rot, Wilt, Smut, Pokkah boeng, Ratoon stunting
        Water: 1500-2500mm, critical at tillering and grand growth""",
        "months": list(range(1, 13))
    },
    
    # Tomato
    {
        "crop": "tomato", "category": "vegetable", "season": "multi",
        "text": """Tomato (Solanum lycopersicum) - Multiple Seasons
        Kharif: Nursery May-Jun, Transplant Jun-Jul, Harvest Aug-Nov
        Rabi: Nursery Sep-Oct, Transplant Oct-Nov, Harvest Dec-Apr
        Summer: Nursery Jan-Feb, Transplant Feb-Mar, Harvest Apr-Jun
        Optimal: Temperature 20-28°C, Frost sensitive
        Spacing: 60x45 cm (determinate), 90x60 cm (indeterminate)
        Fertilizer: N 180-200, P2O5 100-120, K2O 80-100 kg/ha + CaNO3 for blossom end rot
        Staking/trellising essential for indeterminate
        Varieties: Arka Rakshak, Arka Samrat, Pusa Hybrid-1, Pusa Hybrid-4, Arka Abhijit
        Pests: Fruit borer, Whitefly, Leaf miner, Thrips, Mites
        Diseases: Early blight, Late blight, Bacterial wilt, Fusarium wilt, ToLCV, Leaf curl""",
        "months": list(range(1, 13))
    },
    
    # Potato
    {
        "crop": "potato", "category": "vegetable", "season": "rabi",
        "text": """Potato (Solanum tuberosum) - Rabi Crop
        Planting: October-November (plains), March-April (hills)
        Duration: 90-110 days, Harvest: January-March (plains)
        Optimal: Temperature 15-20°C tuberization, Frost free
        Spacing: 60x20 cm, Seed rate: 25-30 q/ha
        Fertilizer: N 150-180, P2O5 80-100, K2O 100-120 kg/ha
        Varieties: Kufri Jyoti, Kufri Chipsona-1, Kufri Chipsona-3, Kufri Pukhraj, Kufri Sadabahar
        Pests: Cutworm, Aphids, Whitefly, Epilachna beetle
        Diseases: Late blight, Early blight, Black scurf, Common scab, PVX, PLRV
        Critical: Late blight forecasting, earthing up at 30 and 45 DAP""",
        "months": [10, 11, 12, 1, 2, 3]
    },
    
    # Onion
    {
        "crop": "onion", "category": "vegetable", "season": "rabi",
        "text": """Onion (Allium cepa) - Rabi Crop
        Nursery: October-November, Transplant: December-January
        Duration: 120-150 days, Harvest: April-May
        Optimal: Temperature 15-25°C for bulbing, long days
        Spacing: 15x10 cm, Seed rate: 8-10 kg/ha
        Fertilizer: N 100-120, P2O5 50-60, K2O 50-60 kg/ha + S 20-30
        Varieties: Bhima Super, Bhima Red, Bhima White, Agrifound Light Red, Pusa Red
        Pests: Thrips, Onion fly, Cutworm
        Diseases: Purple blotch, Stemphylium blight, Downy mildew, Basal rot""",
        "months": [10, 11, 12, 1, 2, 3, 4, 5]
    },
    
    # Chickpea
    {
        "crop": "chickpea", "category": "pulse", "season": "rabi",
        "text": """Chickpea (Cicer arietinum) - Rabi Pulse
        Sowing: October-November, Duration: 110-130 days, Harvest: February-March
        Optimal: Temperature 15-25°C, Rainfall 300-400mm
        Spacing: 30x10 cm, Seed rate: 75-85 kg/ha
        Fertilizer: N 20-30 (starter), P2O5 50-60, K2O 20-30 kg/ha
        Rhizobium + PSB inoculation essential
        Varieties: Pusa 372, Pusa 256, JG 11, JAKI 9218, GNG 1581
        Pests: Pod borer, Cutworm, Aphids
        Diseases: Wilt, Ascochyta blight, Botrytis grey mold, Stunt virus""",
        "months": [10, 11, 12, 1, 2, 3]
    },
    
    # Pigeonpea
    {
        "crop": "pigeonpea", "category": "pulse", "season": "kharif",
        "text": """Pigeonpea (Cajanus cajan) - Kharif Pulse
        Sowing: June-July, Duration: 150-180 days, Harvest: December-January
        Optimal: Temperature 25-30°C, Rainfall 600-1000mm
        Spacing: 60x20 cm (early), 90x30 cm (late), Seed rate: 12-15 kg/ha
        Fertilizer: N 20-25, P2O5 40-50, K2O 20-30 kg/ha
        Rhizobium + PSB inoculation
        Varieties: ICPL 88039, ICPL 87119, ICPL 151, BDN 2, Maruti
        Pests: Pod borer, Pod fly, Spotted pod borer
        Diseases: Fusarium wilt, Sterility mosaic, Phytophthora blight""",
        "months": [6, 7, 8, 9, 10, 11, 12, 1]
    },
    
    # Mango
    {
        "crop": "mango", "category": "fruit", "season": "perennial",
        "text": """Mango (Mangifera indica) - Perennial Fruit
        Flowering: December-February (varies by region/variety)
        Fruit set: Requires 15-20°C night temp, dry weather
        Harvest: April-July (variety dependent)
        Optimal: Temperature 24-28°C, well-distributed rainfall 750-2500mm
        Dry period during flowering critical
        Varieties: Alphonso, Kesar, Dashehari, Langra, Chausa, Banganapalli, Totapuri
        Fertilizer (per tree/year): N 500-1000g, P2O5 300-500g, K2O 500-1000g (split doses)
        Pests: Hopper, Mealybug, Fruit fly, Stone weevil
        Diseases: Powdery mildew, Anthracnose, Malformation, Dieback
        Flower induction: Paclobutrazol (if needed), KNO3 spray""",
        "months": list(range(1, 13))
    },
    
    # Banana
    {
        "crop": "banana", "category": "fruit", "season": "perennial",
        "text": """Banana (Musa spp.) - Perennial Fruit
        Planting: Year-round (best June-Sept or Feb-Mar)
        Duration: 12-15 months to harvest, then ratoon
        Optimal: Temperature 25-30°C, Rainfall 1500-2500mm, High humidity
        Spacing: 1.8x1.8m (dwarf), 2.4x2.4m (tall), Tissue culture preferred
        Fertilizer (per plant/cycle): N 250-300g, P2O5 100-150g, K2O 300-400g (monthly splits)
        Varieties: Grand Naine, Dwarf Cavendish, Robusta, Nendran, Rasthali, Poovan
        Pests: Rhizome weevil, Pseudostem borer, Aphids, Thrips
        Diseases: Panama wilt, Sigatoka leaf spot, Bunchy top, Freckle
        Critical: Desuckering, propping, bunch covering, nutrient management""",
        "months": list(range(1, 13))
    },
    
    # General Soil & Nutrient Management
    {
        "crop": "general", "category": "soil", "season": "all",
        "text": """Soil Health Management - Universal Principles
        Optimal pH: 6.0-7.5 for most crops
        Acidic soils (<5.5): Apply lime @ 2-5 t/ha based on buffer capacity
        Alkaline soils (>8.0): Apply gypsum @ 2-5 t/ha, grow salt-tolerant crops
        Organic Matter: Maintain >1.5% (tropical), >2.5% (temperate)
        FYM/Compost: 10-15 t/ha annually or 5-10 t/ha per crop
        Green Manuring: Dhaincha, Sunhemp, Cowpea - incorporate at flowering
        Biofertilizers: Rhizobium (nitrogen), Azotobacter/Azospirillum (free-living N), 
        PSB (phosphate solubilizing), KSB (potash solubilizing), Blue-green algae (rice)
        Micronutrients: Zn (25 kg ZnSO4/ha), B (1-2 kg borax/ha for crucifers), 
        Fe (foliar FeSO4 0.5%), Mn (foliar MnSO4 0.5%)""",
        "months": list(range(1, 13))
    },
    
    # Irrigation Management
    {
        "crop": "general", "category": "water", "season": "all",
        "text": """Irrigation Water Management
        Methods Efficiency: Flood 40-50%, Sprinkler 70-80%, Drip 90-95%, Subsurface drip 95%+
        Scheduling: Based on crop ET (evapotranspiration) and soil moisture depletion
        Critical Stages (must irrigate):
        - Cereals: CRI, Tillering, Jointing, Flowering, Grain fill
        - Pulses: Flowering, Pod formation
        - Oilseeds: Flowering, Seed fill
        - Vegetables: Transplanting, Flowering, Fruit development
        - Fruit trees: Fruit set, Fruit development, Pre-harvest
        Water Quality: EC < 0.7 dS/m (good), 0.7-3.0 (permissible), >3.0 (unsuitable)
        SAR < 10 for most crops
        Drip Fertigation: Saves 30-50% water, 20-30% fertilizer, increases yield 20-40%
        Mulching: Plastic (silver/black) or organic (straw, leaves) saves 30-50% water
        Deficit Irrigation: Apply <ET at non-critical stages, full at critical stages""",
        "months": list(range(1, 13))
    },
    
    # Pest Management
    {
        "crop": "general", "category": "pest", "season": "all",
        "text": """Integrated Pest Management (IPM) - Universal
        Monitoring: Weekly scouting, Pheromone traps (5-10/ha), Yellow/blue sticky traps (10-20/ha)
        ETL (Economic Threshold Levels) - spray only when exceeded:
        - Cotton bollworm: 5% damaged bolls or 1 larva/plant
        - Rice stem borer: 5% dead hearts or 1 egg mass/m²
        - Soybean Spodoptera: 2 larvae/plant or 10% defoliation
        - Tomato fruit borer: 5% fruit damage
        Cultural: Timely sowing, Resistant varieties, Crop rotation, Intercropping, Trap crops (marigold, castor)
        Mechanical: Hand picking, Light traps, Bird perches (50/ha)
        Biological: Trichogramma (egg parasitoid), NPV (nuclear polyhedrosis virus), 
        Bt (Bacillus thuringiensis), Beauveria bassiana, Metarhizium anisopliae
        Botanical: Neem oil 1-2%, Neem seed kernel extract 5%, Garlic-chili extract
        Chemical: Last resort, rotate MOA (mode of action), follow label, observe PHI (pre-harvest interval)
        Resistance Management: Don't repeat same MOA >2 times, use mixtures/rotations""",
        "months": list(range(1, 13))
    },
    
    # Weather-based Farming
    {
        "crop": "general", "category": "weather", "season": "all",
        "text": """Weather-Based Agricultural Decision Making
        Temperature Thresholds:
        - Wheat germination: 12-25°C, Flowering: 15-20°C, Grain fill: 20-25°C
        - Rice tillering: 25-30°C, Flowering: 30-33°C (spikelet sterility >35°C)
        - Cotton germination: 18-30°C, Flowering: 27-32°C
        - Tomato fruit set: 18-26°C (poor <13°C or >32°C)
        
        Rainfall Decisions:
        - >75% probability: Good for sowing
        - Dry spell >10 days at critical stage: Irrigate immediately
        - >50mm in 24h: Delay fertilizer/spray, ensure drainage
        
        Humidity:
        - >80% RH for >48h: Fungal disease alert
        - <40% RH: Mite/thrips alert, increase irrigation
        
        Wind:
        - >15 km/h: Avoid spraying
        - >25 km/h: Lodging risk in cereals
        
        Forecast Use:
        - 3-day: Spraying/fertilizer decisions
        - 7-day: Irrigation planning
        - 14-day: Harvest timing
        
        Extreme Events:
        - Heat wave (>40°C 3+ days): Increase irrigation 20%, avoid spraying, shade nets for vegetables
        - Cold wave (<5°C): Smoke/frost protection, irrigation for heat retention
        - Hail: Net covering, immediate harvest if near maturity
        - Cyclone/Flood: Drainage, mechanical support, post-event disease management""",
        "months": list(range(1, 13))
    },

    # Sorghum / Jowar
    {
        "crop": "sorghum", "category": "cereal", "season": "kharif",
        "text": """Sorghum/Jowar (Sorghum bicolor) - Kharif Cereal
        Optimal Weather: Temperature 25-32°C, Humidity 50-75%; drought-tolerant
        Rainfall: 400-600mm; Rainfall probability >60% good for sowing
        Sowing: June-July, Duration: 90-120 days, Harvest: October-November
        Spacing: 45x15 cm, Seed rate: 10-12 kg/ha
        Soil: pH 6.0-7.5, well-drained loam; tolerates slightly alkaline soils
        Fertilizer (kg/ha): N 80-100 (50% basal, 50% at knee-height 30 DAS), P2O5 40-50, K2O 30-40
        Micronutrients: ZnSO4 25 kg/ha if Zn-deficient
        Varieties: CSH 16, CSH 17, CSV 15, SPV 462, Pusa Chari (fodder)
        Water stress: Sensitive at flowering and grain fill; withstands pre-flowering drought
        Pests: Shoot fly, Stem borer, Midge, Aphids, Army worm
        Diseases: Grain mold, Downy mildew, Anthracnose, Smut
        Yield target: 25-35 q/ha grain, 100-150 q/ha fodder""",
        "months": [6, 7, 8, 9, 10, 11]
    },

    # Pearl Millet / Bajra
    {
        "crop": "bajra", "category": "cereal", "season": "kharif",
        "text": """Pearl Millet/Bajra (Pennisetum glaucum) - Kharif Cereal
        Optimal Weather: Temperature 25-35°C, Humidity 40-65%; extremely heat and drought tolerant
        Rainfall: 150-600mm; Rainfall probability >50% sufficient; grows in arid/semi-arid regions
        Sowing: June-July, Duration: 65-90 days, Harvest: September-October
        Spacing: 45x15 cm, Seed rate: 3-4 kg/ha (hybrid), 5-6 kg/ha (varieties)
        Soil: pH 6.0-8.0, sandy loam to loam; tolerates poor soils
        Fertilizer (kg/ha): N 60-80 (50% basal, 50% at 25 DAS), P2O5 40-50, K2O 20-30
        Hybrids: HHB 67, HHB 197, GHB 538, MH 169, Pusa Composite 383
        Water stress: Tolerates drought at vegetative; irrigate at flowering if rainfall fails
        Pests: Shoot fly, Stem borer, Millet weevil, Aphids
        Diseases: Downy mildew, Ergot, Smut, Rust, Blast
        Yield target: 20-30 q/ha grain; 80-120 q/ha stover""",
        "months": [6, 7, 8, 9, 10]
    },

    # Finger Millet / Ragi
    {
        "crop": "ragi", "category": "cereal", "season": "kharif",
        "text": """Finger Millet/Ragi (Eleusine coracana) - Kharif Cereal
        Optimal Weather: Temperature 20-30°C, Humidity 60-80%; cool nights preferred
        Rainfall: 700-1000mm; Rainfall probability >65%; semi-arid to sub-humid
        Sowing: June-July, Duration: 90-120 days, Harvest: October-November
        Spacing: 30x10 cm (transplanted), Seed rate: 8-10 kg/ha
        Soil: pH 5.5-7.5, red loamy soils; low fertility tolerance
        Fertilizer (kg/ha): N 60-80, P2O5 40-50, K2O 40-50; ZnSO4 25 kg/ha, S 20 kg/ha
        Varieties: GPU 28, GPU 45, HR 911, MR 6, Indaf 5
        Water: Moderate irrigation at flowering; waterlogging must be avoided
        Pests: Aphids, Shoot fly, Stem borer
        Diseases: Blast (major), Brown spot, Foot rot, Neck blast
        Yield target: 25-35 q/ha; High Ca and Fe nutritional content""",
        "months": [6, 7, 8, 9, 10, 11]
    },

    # Barley
    {
        "crop": "barley", "category": "cereal", "season": "rabi",
        "text": """Barley (Hordeum vulgare) - Rabi Cereal
        Optimal Weather: Temperature 12-20°C, Humidity 50-70%; more drought-tolerant than wheat
        Rainfall: 250-500mm; Rainfall probability >50% adequate
        Sowing: October-November, Duration: 110-130 days, Harvest: March-April
        Row spacing: 22.5 cm, Seed rate: 75-100 kg/ha
        Soil: pH 6.0-8.0, loam to sandy loam; tolerates slightly saline soils
        Fertilizer (kg/ha): N 60-80 (50% basal, 50% CRI), P2O5 30-40, K2O 20-30
        Varieties: DWRUB 52, BH 902, NDB 1173, KBSH 8, Ratna
        Irrigation: 2-3 irrigations (CRI 21 DAS, Jointing, Milking)
        Pests: Aphids, Termites
        Diseases: Yellow rust, Stripe disease, Net blotch, Scald
        Yield target: 25-35 q/ha; used for malt, feed, food""",
        "months": [10, 11, 12, 1, 2, 3, 4]
    },

    # Sunflower
    {
        "crop": "sunflower", "category": "oilseed", "season": "kharif",
        "text": """Sunflower (Helianthus annuus) - Kharif/Rabi Oilseed
        Optimal Weather: Temperature 22-30°C, Humidity 50-75%; bright sunshine during seed fill
        Rainfall: 500-800mm; Rainfall probability 55-70%; cannot tolerate waterlogging
        Kharif: Sow June-July; Rabi: Sow October-November; Summer: January-February
        Duration: 85-110 days; Spacing: 60x30 cm, Seed rate: 5-6 kg/ha
        Soil: pH 6.0-7.5, deep well-drained loam
        Fertilizer (kg/ha): N 80-100 (50% basal, 50% pre-flower), P2O5 60-80, K2O 30-40
        Boron: 0.5-1.0 kg/ha borax for pollen viability and seed set
        Hybrids: KBSH 1, KBSH 44, DRSH 1, Sungold 100
        Irrigation: 4-5 irrigations (germination, vegetative, bud, flowering, seed fill)
        Pests: Head borer, Leaf roller, Whitefly, Aphids
        Diseases: Downy mildew, Alternaria blight, Sclerotinia, Rust
        Yield target: 15-25 q/ha; Oil content 38-45%""",
        "months": [6, 7, 8, 9, 10, 1, 2, 3]
    },

    # Lentil / Masoor
    {
        "crop": "lentil", "category": "pulse", "season": "rabi",
        "text": """Lentil/Masoor (Lens culinaris) - Rabi Pulse
        Optimal Weather: Temperature 15-25°C, Humidity 50-70%; cool and dry
        Rainfall: 250-400mm; Rainfall probability 45-60% adequate
        Sowing: October-November, Duration: 100-130 days, Harvest: February-March
        Spacing: 30x5 cm, Seed rate: 40-50 kg/ha
        Soil: pH 6.0-8.0, sandy loam to clay loam, well-drained
        Fertilizer (kg/ha): N 20-25 (starter), P2O5 40-50, K2O 20-30; Rhizobium + PSB inoculation
        Sulfur: 20 kg/ha improves protein quality
        Varieties: L 4076, Malika, Pant L 406, DPL 15, IPL 316
        Irrigation: 2-3 (pre-sowing, flowering, pod fill) if rainfall insufficient
        Pests: Aphids, Pod borer, Leaf roller
        Diseases: Rust, Ascochyta blight, Stemphylium, Wilt
        Yield target: 12-18 q/ha; high protein 24-26%""",
        "months": [10, 11, 12, 1, 2, 3]
    },

    # Green Gram / Moong
    {
        "crop": "moong", "category": "pulse", "season": "kharif",
        "text": """Green Gram/Moong (Vigna radiata) - Kharif/Summer Pulse
        Optimal Weather: Temperature 25-35°C, Humidity 60-80%; warm and humid
        Rainfall: 500-700mm; Rainfall probability 60-75%; avoid waterlogging
        Kharif: June-July; Summer: February-March; Duration: 60-75 days
        Spacing: 30x10 cm, Seed rate: 20-25 kg/ha
        Soil: pH 6.0-7.5, well-drained loamy soils
        Fertilizer (kg/ha): N 20-25 (starter only), P2O5 40-50, K2O 20-30
        Rhizobium + PSB inoculation (fixes 40-80 kg N/ha)
        Varieties: Pusa Vishal, SML 668, Pusa Ratna, MH 421, TM 99-37
        Irrigation: 3-4 (germination, flowering, pod fill, pod maturity)
        Pests: Thrips, Whitefly (YMV vector), Pod borer, Bruchids
        Diseases: Yellow mosaic virus (major), Cercospora, Powdery mildew
        Yield target: 10-15 q/ha""",
        "months": [6, 7, 8, 9, 2, 3, 4, 5]
    },

    # Brinjal / Eggplant
    {
        "crop": "brinjal", "category": "vegetable", "season": "multi",
        "text": """Brinjal/Eggplant (Solanum melongena) - Year-round Vegetable
        Optimal Weather: Temperature 22-30°C, Humidity 60-75%; warm and sunny
        Rainfall: 600-1000mm; Rainfall probability 60-70%; no frost, no waterlogging
        Kharif: Nursery April-May, Transplant June-July; Duration: 6-8 months continuous harvesting
        Spacing: 75x60 cm, Seed rate: 400-500g/ha
        Soil: pH 5.5-7.0, well-drained loamy soil
        Fertilizer (kg/ha): N 150-200 (split 3-4 times), P2O5 80-100, K2O 80-100 (split 2-3 times)
        Varieties: Pusa Purple Long, Pusa Purple Cluster, Arka Keshav, BH 2 (hybrid)
        Irrigation: Weekly; drip preferred
        Pests: Shoot and fruit borer (major), Jassids, Whitefly, Mites
        Diseases: Phomopsis blight, Little leaf (MLO), Mosaic, Wilt
        Yield target: 250-400 q/ha""",
        "months": list(range(1, 13))
    },

    # Okra / Bhindi
    {
        "crop": "okra", "category": "vegetable", "season": "kharif",
        "text": """Okra/Bhindi (Abelmoschus esculentus) - Kharif/Summer Vegetable
        Optimal Weather: Temperature 25-35°C, Humidity 60-80%; hot and humid; heat-tolerant
        Rainfall: 500-800mm; Rainfall probability 60-70%
        Kharif: June-July; Summer: February-March; Duration: 45-90 days picking
        Spacing: 45x30 cm, Seed rate: 10-15 kg/ha
        Soil: pH 6.0-6.8, well-drained sandy loam to clay loam
        Fertilizer (kg/ha): N 100-120 (1/3 basal, 1/3 at 30 DAS, 1/3 at first picking), P2O5 60-70, K2O 60-70
        Boron: 1-2 kg/ha borax prevents fruit deformity
        Varieties: Arka Anamika, Parbhani Kranti, VRO 6, Varsha Uphar
        Pests: Jassids, Whitefly (YVMV vector), Shoot and fruit borer, Mites
        Diseases: Yellow vein mosaic (major), Powdery mildew, Cercospora, Fusarium wilt
        Yield target: 100-150 q/ha fresh pods""",
        "months": [6, 7, 8, 9, 2, 3, 4, 5]
    },

    # Cauliflower
    {
        "crop": "cauliflower", "category": "vegetable", "season": "rabi",
        "text": """Cauliflower (Brassica oleracea botrytis) - Rabi Cole Crop
        Optimal Weather: Temperature 15-20°C (curd development); Humidity 65-80%; cool and moist
        Rainfall: 400-600mm; Rainfall probability 55-70%; frost tolerant
        Early: Transplant Aug-Sep; Main: Oct-Nov; Duration: 60-120 days
        Spacing: 60x45 cm (main season); Seed rate: 400-600g/ha
        Soil: pH 6.0-7.5, deep well-drained loamy soil
        Fertilizer (kg/ha): N 120-150 (split 3 times), P2O5 60-80, K2O 60-80
        Boron: 1-2 kg/ha borax prevents browning; Molybdenum 0.5-1.0 kg/ha prevents whiptail
        Varieties: Pusa Snowball K-1, Pusa Sharad, Pusa Shubhra, Arka Megha
        Pests: Diamond back moth, Aphids, Cabbage butterfly, Cutworm
        Diseases: Black rot, Alternaria blight, Damping off, Club root
        Yield target: 200-300 q/ha""",
        "months": [8, 9, 10, 11, 12, 1, 2]
    },

    # Watermelon
    {
        "crop": "watermelon", "category": "vegetable", "season": "summer",
        "text": """Watermelon (Citrullus lanatus) - Summer Cucurbit
        Optimal Weather: Temperature 25-35°C; Humidity 50-70%; hot, dry and sunny
        Rainfall: 300-500mm; Rainfall probability 45-55%; drought tolerant once established
        Summer: February-March; Kharif: June-July; Duration: 80-100 days
        Spacing: 3x1.5 m, Seed rate: 3-4 kg/ha
        Soil: pH 6.0-7.0, well-drained sandy loam; deep soils preferred
        Fertilizer (kg/ha): N 80-100 (split 3 times), P2O5 60-80, K2O 50-70
        Boron 1 kg/ha and Ca spray improve sweetness and firmness
        Varieties: Sugar Baby, Arka Manik, Arka Jyoti, Kiran, Durgapura Kesari
        Irrigation: Drip preferred; reduce irrigation near harvest for sweetness
        Pests: Red pumpkin beetle, Aphids, Fruit fly, Thrips
        Diseases: Fusarium wilt, Powdery mildew, Downy mildew, Anthracnose, Mosaic
        Yield target: 300-500 q/ha""",
        "months": [2, 3, 4, 5, 6, 7]
    },

    # Turmeric
    {
        "crop": "turmeric", "category": "spice", "season": "kharif",
        "text": """Turmeric (Curcuma longa) - Kharif Spice Crop
        Optimal Weather: Temperature 20-30°C, Humidity 70-90%; warm and humid; semi-shade tolerance
        Rainfall: 1500-2000mm; Rainfall probability 70-80%; semi-shade beneficial
        Planting: April-May (onset of monsoon), Duration: 7-9 months, Harvest: January-February
        Seed rhizomes: 2000-2500 kg/ha; Spacing: 45x30 cm, Depth: 5-7 cm
        Soil: pH 4.5-7.5, well-drained sandy loam to clay loam, rich organic matter
        Fertilizer (kg/ha): N 60-80 (3 splits at 40, 90, 120 DAS), P2O5 30-40, K2O 60-80
        FYM: 40 t/ha; Neem cake 2 t/ha prevents rhizome rot; ZnSO4 30 kg/ha
        Varieties: Pratibha, Sugandham, Rasmi, IISR Alleppey Supreme, Erode Local
        Mulching: Paddy straw 10-12 t/ha (essential for moisture and weed control)
        Pests: Rhizome scale, Thrips, Shoot borer
        Diseases: Rhizome rot (Pythium), Leaf blotch, Leaf spot
        Yield target: 250-350 q/ha fresh; 50-70 q/ha dry
        Curcumin content: 3-7% in dry rhizome""",
        "months": [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]
    },

    # Ginger
    {
        "crop": "ginger", "category": "spice", "season": "kharif",
        "text": """Ginger (Zingiber officinale) - Kharif Spice Crop
        Optimal Weather: Temperature 20-30°C, Humidity 70-90%; warm humid; partial shade tolerance
        Rainfall: 1500-3000mm; Rainfall probability 70-85%; sensitive to drought and waterlogging
        Planting: April-May, Duration: 8-10 months, Harvest: December-February (dry) or July-October (fresh)
        Seed rhizomes: 1500-2000 kg/ha (2-3 eye sets, 20-25g each); Spacing: 30x25 cm, Depth: 5 cm
        Soil: pH 5.5-7.0, well-drained friable loam; high organic matter
        Fertilizer (kg/ha): N 80-100 (3-4 splits), P2O5 50-60, K2O 80-100
        FYM: 30-40 t/ha; Neem cake 2 t/ha; Mulching: Green leaves 10-12 t/ha (applied 3 times)
        Varieties: Maran, Wayanad Local, IISR Varada, IISR Mahima, Suprabha
        Irrigation: 7-10 day intervals; drip/sprinkler; avoid standing water
        Pests: Shoot borer, Rhizome fly, Leaf roller
        Diseases: Soft rot/Pythium (major), Bacterial wilt, Yellow disease, Dry rot
        Yield target: 200-350 q/ha fresh; 50-80 q/ha dry""",
        "months": [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]
    },

    # Garlic
    {
        "crop": "garlic", "category": "vegetable", "season": "rabi",
        "text": """Garlic (Allium sativum) - Rabi Bulb Crop
        Optimal Weather: Temperature 12-24°C (bulbing requires short days + cool temp); Humidity 60-70%
        Rainfall: 200-400mm; Rainfall probability 45-60%; avoid excess moisture near harvest
        Planting: October-November; Duration: 120-150 days; Harvest: March-April
        Seed material: 500-600 kg/ha cloves; Spacing: 15x10 cm
        Soil: pH 6.0-7.5, well-drained sandy loam, rich in organic matter
        Fertilizer (kg/ha): N 100-120 (50% basal, 50% at 30 DAS), P2O5 50-60, K2O 50-60
        Sulfur: 30-40 kg/ha (improves allicin flavor compounds); ZnSO4 25 kg/ha
        Varieties: Yamuna Safed, G-1, G-50, GG 4, Agrifound White
        Irrigation: 8-10 irrigations (every 7-10 days); stop 2-3 weeks before harvest for curing
        Pests: Thrips (major), Mites, Onion fly
        Diseases: Purple blotch, Stemphylium, White rot, Basal rot
        Yield target: 100-150 q/ha fresh; 60-80 q/ha dry""",
        "months": [10, 11, 12, 1, 2, 3, 4]
    },

    # Papaya
    {
        "crop": "papaya", "category": "fruit", "season": "perennial",
        "text": """Papaya (Carica papaya) - Year-round Fruit Crop
        Optimal Weather: Temperature 22-32°C, Humidity 65-80%; warm tropical; frost-sensitive
        Rainfall: 1000-1500mm; Rainfall probability 60-70%; cannot tolerate waterlogging
        Planting: Year-round (best Feb-Mar or Jun-Jul); bearing starts 6-9 months
        Spacing: 2.5x2.5 m (monoecious), 3x2 m (dioecious)
        Soil: pH 6.0-7.5, well-drained loamy soil
        Fertilizer (per plant/year): N 200-250g, P2O5 200-250g, K2O 400-500g (monthly splits)
        FYM: 15-20 kg/plant/year; ZnSO4 50g/plant; Boron 2g/plant
        Varieties: Pusa Dwarf, Pusa Majesty, Pusa Nanha, Coorg Honey Dew, Taiwan 786, Surya
        Irrigation: 8-10 day intervals (drip preferred); mulching essential
        Pests: Mealybugs, Fruit fly, Mites, Aphids (PRSV vector)
        Diseases: Papaya ring spot virus (PRSV - major), Anthracnose, Stem rot, Powdery mildew
        Yield target: 800-1500 q/ha fresh fruit/year""",
        "months": list(range(1, 13))
    },

    # NPK × Weather Matrix
    {
        "crop": "general", "category": "nutrient_weather", "season": "all",
        "text": """Crop Nutrient Requirements and Weather Interactions

        NITROGEN (N) kg/ha by crop:
        Sugarcane: 250-300 | Cotton: 150-200 | Maize: 150-180 | Potato: 150-180
        Wheat: 120-150 | Rice: 100-120 | Tomato: 150-200 | Brinjal: 150-200
        Sorghum: 80-100 | Sunflower: 80-100 | Barley: 60-80 | Ragi: 60-80 | Bajra: 60-80
        Chickpea: 20-30 | Soybean: 20-30 | Moong: 20-25 | Groundnut: 20-30 (all use Rhizobium)

        PHOSPHORUS (P2O5) kg/ha:
        Potato: 80-100 | Tomato: 80-100 | Cauliflower: 80-100 | Wheat: 60-80 | Sunflower: 60-80
        Rice: 50-60 | Maize: 50-60 | Chickpea: 50-60 | Lentil: 40-50 | Moong: 40-50

        POTASSIUM (K2O) kg/ha:
        Sugarcane: 150-200 | Potato: 100-120 | Cotton: 80-100 | Tomato: 80-100
        Rice: 40-50 | Wheat: 40-60 | Okra: 60-70 | Turmeric: 60-80 | Ginger: 80-100

        TEMPERATURE vs FERTILIZER EFFICIENCY:
        Below 10°C: Phosphorus uptake severely reduced; apply MKP foliar spray
        Above 35°C: Urea volatilization increases 30-50%; prefer incorporated or fertigation
        Optimal 20-28°C: Maximum fertilizer use efficiency

        HUMIDITY EFFECTS:
        High humidity >80%: N loss via denitrification; split application essential
        Low humidity <40%: Micronutrient uptake impaired; foliar Zn, Fe, Mn, B spray needed
        Optimal 50-70%: Best nutrient uptake and root activity""",
        "months": list(range(1, 13))
    },

    # Regional Crop-Climate Guide
    {
        "crop": "general", "category": "regional", "season": "all",
        "text": """Regional Crop-Climate Suitability Guide for India

        PUNJAB/HARYANA (Semi-arid, Canal irrigated):
        Temperature: Winter 5-20°C, Summer 28-45°C; Rainfall: 400-700mm (monsoon heavy)
        Best Crops: Wheat (Rabi), Paddy (Kharif), Maize, Cotton, Sugarcane
        Optimal planting window wheat: November 1-15; paddy transplanting: June 15-July 15
        N recommendation wheat: 120-150 kg/ha; split at sowing, CRI (25 DAS), jointing (45 DAS)

        MAHARASHTRA (Diverse - semi-arid to coastal):
        Temperature: 15-40°C; Rainfall: 400-3000mm (varies by region)
        Vidarbha: Cotton, Soybean, Oranges; Marathwada: Sorghum, Chickpea, Grapes
        Konkan: Rice, Mango, Coconut, Cashew; Nashik: Onion, Grapes, Tomato
        Monsoon failure in Marathwada: Prefer drought-tolerant sorghum/bajra

        KARNATAKA (Humid to semi-arid):
        Temperature: 20-35°C; Rainfall: 500-4000mm (Western Ghats vs Deccan Plateau)
        North Karnataka: Cotton, Sorghum, Sunflower, Chickpea
        South Karnataka: Ragi, Maize, Sugarcane; Coastal: Rice, Coconut, Arecanut, Spices
        Ragi thrives in red laterite with 700-900mm rainfall

        ANDHRA PRADESH/TELANGANA:
        Temperature: 22-44°C; Rainfall: 600-1100mm
        Best Crops: Rice (Krishna Delta), Cotton, Chilli, Groundnut, Maize
        Cyclone risk Oct-Dec: Drain paddy; secure vegetable crops

        RAJASTHAN (Arid/Desert):
        Temperature: 2-48°C; Rainfall: 100-500mm
        Best Crops: Bajra, Moth bean, Cluster bean (Guar), Mustard, Cumin
        Bajra needs only 250mm rainfall; sow with first monsoon rain

        UTTAR PRADESH (Fertile Gangetic Plain):
        Temperature: 5-42°C; Rainfall: 600-1000mm
        Best Crops: Wheat, Rice, Sugarcane, Potato, Mustard, Pea, Vegetables
        Wheat+Potato+Mustard rotation maximizes income on irrigated land""",
        "months": list(range(1, 13))
    },
]


class RAGService:
    def __init__(self):
        self.embedding_model_name = settings.RAG_EMBEDDING_MODEL
        self.index_path = settings.RAG_INDEX_PATH
        self.chunks_path = settings.RAG_CHUNKS_PATH
        self.metadata_path = settings.RAG_METADATA_PATH
        self.top_k = settings.RAG_TOP_K
        self.similarity_threshold = settings.RAG_SIMILARITY_THRESHOLD
        
        self.model: Optional[SentenceTransformer] = None
        self.index: Optional[faiss.Index] = None
        self.chunks: List[RAGChunk] = []
        self.initialized = False
    
    async def initialize(self):
        try:
            logger.info("Initializing RAG service...")
            self.model = SentenceTransformer(self.embedding_model_name)
            logger.info(f"Loaded embedding model: {self.embedding_model_name}")
            
            if os.path.exists(self.index_path) and os.path.exists(self.chunks_path):
                await self._load_index()
            else:
                await self._build_index()
            
            self.initialized = True
            logger.info(f"RAG service initialized with {len(self.chunks)} chunks")
        except Exception as e:
            logger.error(f"RAG initialization failed: {e}")
            self.initialized = True
            self.chunks = self._get_fallback_chunks()
    
    async def _load_index(self):
        self.index = faiss.read_index(self.index_path)
        chunks_df = pd.read_csv(self.chunks_path)
        with open(self.metadata_path, 'r') as f:
            metadata = json.load(f)
        
        self.chunks = []
        for _, row in chunks_df.iterrows():
            chunk_id = int(row['id'])
            self.chunks.append(RAGChunk(
                id=chunk_id,
                text=row['text'],
                metadata=metadata.get(str(chunk_id), {})
            ))
        logger.info(f"Loaded {len(self.chunks)} chunks from disk")
    
    async def _build_index(self):
        documents = self._get_all_documents()
        
        self.chunks = []
        chunk_id = 0
        for doc in documents:
            chunks = self._split_text(doc['text'], max_tokens=500)
            for chunk_text in chunks:
                self.chunks.append(RAGChunk(
                    id=chunk_id,
                    text=chunk_text,
                    metadata={
                        'source': doc['source'],
                        'category': doc['category'],
                        'crop': doc.get('crop', 'general'),
                        'season': doc.get('season', 'all'),
                    }
                ))
                chunk_id += 1
        
        logger.info(f"Generating embeddings for {len(self.chunks)} chunks...")
        texts = [c.text for c in self.chunks]
        embeddings = self.model.encode(texts, show_progress_bar=True, batch_size=32)
        
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings.astype('float32'))
        
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        
        chunks_df = pd.DataFrame([{'id': c.id, 'text': c.text} for c in self.chunks])
        chunks_df.to_csv(self.chunks_path, index=False)
        
        metadata = {str(c.id): c.metadata for c in self.chunks}
        with open(self.metadata_path, 'w') as f:
            json.dump(metadata, f)
        
        logger.info(f"Built and saved index with {len(self.chunks)} chunks")
    
    def _get_all_documents(self) -> List[Dict]:
        return [
            {
                'source': f'ICAR {crop.title()} Package of Practices',
                'category': cat,
                'crop': crop,
                'season': season,
                'text': text
            }
            for crop, cat, season, text in [
                (item['crop'], item['category'], item['season'], item['text'])
                for item in CROP_KNOWLEDGE_BASE
            ]
        ]
    
    def _split_text(self, text: str, max_tokens: int = 500) -> List[str]:
        words = text.split()
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for word in words:
            word_tokens = len(word) / 4
            if current_tokens + word_tokens > max_tokens and current_chunk:
                chunks.append(' '.join(current_chunk))
                current_chunk = [word]
                current_tokens = word_tokens
            else:
                current_chunk.append(word)
                current_tokens += word_tokens
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def _get_fallback_chunks(self) -> List[RAGChunk]:
        return [
            RAGChunk(0, "Wheat: Sow Nov-Dec, 100-125 kg/ha seed, 120-150 kg N/ha, irrigate at CRI/tillering/jointing/flowering/grain-fill.", {'crop': 'wheat', 'category': 'cereal'}),
            RAGChunk(1, "Rice Kharif: Transplant Jun-Jul, 40-60 kg/ha seed, 100-120 kg N/ha, maintain 2-5cm standing water.", {'crop': 'rice', 'category': 'cereal'}),
            RAGChunk(2, "Cotton: Sow Apr-May (North), Jun-Jul (Central), 1.5-2.5 kg/ha hybrid seed, 150-200 kg N/ha, IPM for bollworms.", {'crop': 'cotton', 'category': 'fiber'}),
            RAGChunk(3, "Tomato: Transplant 25-30 day seedlings, 60x45 cm spacing, 180-200 kg N/ha, stake indeterminate varieties.", {'crop': 'tomato', 'category': 'vegetable'}),
        ]
    
    async def search_chunks(self, query: str, top_k: int = 5) -> Tuple[str, List[Dict[str, Any]], int]:
        """Retrieval only — returns (context_string, sources, num_chunks). Does NOT call Groq."""
        results = await self.search(query, top_k=top_k)
        context_parts = []
        sources = []
        for chunk, score in results:
            context_parts.append(f"[Relevance: {score:.2f}]\n{chunk.text}")
            sources.append({
                "source": chunk.metadata.get("source", "Unknown"),
                "category": chunk.metadata.get("category", "general"),
                "crop": chunk.metadata.get("crop", "general"),
                "relevance": score,
                "text_preview": chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text,
            })
        context = "\n\n---\n\n".join(context_parts) if context_parts else ""
        return context, sources, len(results)

    async def search(self, query: str, top_k: Optional[int] = None, filters: Optional[Dict] = None) -> List[Tuple[RAGChunk, float]]:
        if not self.initialized or not self.index or not self.model:
            return [(c, 0.5) for c in self.chunks[:top_k or self.top_k]]
        
        k = top_k or self.top_k
        query_embedding = self.model.encode([query])
        faiss.normalize_L2(query_embedding)
        
        scores, indices = self.index.search(query_embedding.astype('float32'), k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.chunks) and score >= self.similarity_threshold:
                chunk = self.chunks[idx]
                if filters:
                    match = True
                    for key, value in filters.items():
                        if chunk.metadata.get(key) != value:
                            match = False
                            break
                    if not match:
                        continue
                results.append((chunk, float(score)))
        
        return results
    
    async def generate_answer(
        self,
        query: str,
        location: Optional[str] = None,
        weather_data: Optional[Dict] = None,
        language: str = "en",
    ) -> RAGResult:
        from app.services.groq_service import groq_service
        
        search_results = await self.search(query, top_k=5)
        
        context_parts = []
        sources = []
        for chunk, score in search_results:
            context_parts.append(f"[Source: {chunk.metadata.get('source', 'Unknown')}, Relevance: {score:.2f}]\n{chunk.text}")
            sources.append({
                'source': chunk.metadata.get('source', 'Unknown'),
                'category': chunk.metadata.get('category', 'general'),
                'crop': chunk.metadata.get('crop', 'general'),
                'relevance': score,
                'text_preview': chunk.text[:200] + '...' if len(chunk.text) > 200 else chunk.text,
            })
        
        context = '\n\n---\n\n'.join(context_parts) if context_parts else ""
        
        response = await groq_service.agricultural_query(
            query=query,
            context=context,
            location=location,
            weather_data=weather_data,
            language=language,
        )
        
        avg_relevance = sum(s['relevance'] for s in sources) / len(sources) if sources else 0.5
        confidence = min(0.95, 0.4 + 0.5 * avg_relevance)
        
        return RAGResult(
            answer=response.content,
            sources=sources,
            confidence=confidence,
            chunks_used=len(search_results),
        )
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            'initialized': self.initialized,
            'total_chunks': len(self.chunks),
            'embedding_model': self.embedding_model_name,
            'index_type': type(self.index).__name__ if self.index else None,
            'categories': list(set(c.metadata.get('category', 'unknown') for c in self.chunks)),
            'crops': list(set(c.metadata.get('crop', 'unknown') for c in self.chunks)),
        }


rag_service = RAGService()