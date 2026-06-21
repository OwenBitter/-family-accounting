"""Remove inline sf function from migrate_history.py"""
path = 'backend/scripts/migrate_history.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = ("    md = MonthlyData(month=month_key)\n\n"
       "    def sf(v):\n"
       '        """Safe float conversion"""\n'
       "        if v is None or str(v).strip() in ('', '-', '--'):\n"
       "            return 0.0\n"
       "        return float(str(v).replace(',', '').replace(' ', ''))\n\n"
       "    # ── 总 sheet ──\n")

new = "    md = MonthlyData(month=month_key)\n\n    # ── 总 sheet ──\n"

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK - removed inline sf')
else:
    print('ERROR: pattern not found')
    idx = content.find('md = MonthlyData')
    if idx >= 0:
        print(repr(content[idx:idx+400]))
