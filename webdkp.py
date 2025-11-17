import re
import csv

input_file = "WebDKP.lua"
output_file = "log.csv"

with open(input_file, "r", encoding="utf-8") as f:
    text = f.read()

# 提取每个事件
events = re.findall(r'\["(.*?)"\]\s*=\s*\{(.*?)\n\t\},', text, re.S)
rows = []

for event_name, content in events:
    if event_name.lower() in ("version",):
        continue

    # 抽取关键字段
    points_match = re.search(r'\["points"\]\s*=\s*([-\d\.]+)', content)
    reason_match = re.search(r'\["reason"\]\s*=\s*"([^"]*)"', content)
    date_match = re.search(r'\["date"\]\s*=\s*"([^"]*)"', content)

    points = float(points_match.group(1)) if points_match else 0
    reason = reason_match.group(1) if reason_match else ""
    date = date_match.group(1) if date_match else ""

    # 拆分日期与时间
    date_part, time_part = ("", "")
    if " " in date:
        date_part, time_part = date.split(" ", 1)
    else:
        date_part = date

    # 提取玩家
    awarded_block = re.search(r'\["awarded"\]\s*=\s*\{(.*?)\n\t\t\},', content, re.S)
    if awarded_block:
        players = re.findall(r'\["([^"]+)"\]\s*=\s*\{', awarded_block.group(1))
        for player in players:
            player = player.strip()
            if player:
                # 在日期和时间之间加一个逗号，不要表头
                rows.append([player, points, reason, date_part, time_part])

# 写入 CSV，无表头
with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    for row in rows:
        writer.writerow(row)

print(f"✅ 导出完成，共 {len(rows)} 条记录 → {output_file}")
