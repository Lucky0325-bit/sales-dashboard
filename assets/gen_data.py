# -*- coding: utf-8 -*-
"""
生成演示数据集 data/sales.csv
用途：为看板提供结构真实、可控可复现的模拟数据（非真实业务数据）
"""
import csv
import os
import random
from datetime import date, timedelta

random.seed(20261030)  # 固定随机种子，保证每次生成结果一致

REGION_CITY = {
    "华北": ["北京", "天津", "石家庄"],
    "华东": ["上海", "杭州", "南京", "苏州"],
    "华南": ["深圳", "广州", "厦门"],
    "华中": ["武汉", "长沙", "郑州"],
    "西南": ["成都", "重庆", "昆明"],
}
CHANNELS = ["线上商城", "门店零售", "分销渠道", "企业采购"]
CATEGORIES = {
    "智能硬件": (280, 1600),
    "家居日用": (45, 420),
    "数码配件": (35, 380),
    "健康个护": (60, 520),
}

# 各区域的规模系数，制造真实感差异
REGION_WEIGHT = {"华东": 1.35, "华南": 1.20, "华北": 1.05, "华中": 0.85, "西南": 0.75}
# 各渠道的毛利率特征
CHANNEL_MARGIN = {"线上商城": 0.34, "门店零售": 0.42, "分销渠道": 0.26, "企业采购": 0.30}
# 促销月（6 月、11 月）制造季节性峰值
PROMO_MONTHS = {6: 1.45, 11: 1.62, 12: 1.25}

start = date(2026, 1, 1)
rows = []
for i in range(305):  # 2026-01-01 ~ 2026-10-31
    d = start + timedelta(days=i)
    weekday_factor = 1.18 if d.weekday() >= 5 else 1.0
    month_factor = PROMO_MONTHS.get(d.month, 1.0)
    for region, cities in REGION_CITY.items():
        city = random.choice(cities)
        channel = random.choices(CHANNELS, weights=[0.42, 0.28, 0.19, 0.11])[0]
        category = random.choices(list(CATEGORIES), weights=[0.30, 0.28, 0.25, 0.17])[0]
        lo, hi = CATEGORIES[category]
        unit_price = round(random.uniform(lo, hi), 2)
        base_qty = random.randint(3, 26)
        qty = max(1, int(base_qty * REGION_WEIGHT[region] * weekday_factor * month_factor
                         * random.uniform(0.75, 1.25)))
        amount = round(unit_price * qty, 2)
        margin = CHANNEL_MARGIN[channel] + random.uniform(-0.09, 0.09)
        profit = round(amount * margin, 2)
        rows.append([d.isoformat(), region, city, channel, category, unit_price, qty, amount, profit])

out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "sales.csv")

with open(out_path, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["date", "region", "city", "channel", "category", "unit_price", "qty", "amount", "profit"])
    w.writerows(rows)

print("rows =", len(rows))
print("output =", out_path)
