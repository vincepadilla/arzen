import sys
sys.stdout.reconfigure(encoding='utf-8')

text = open('lrfdscript.js', encoding='utf-8').read()

# Remaining sequences:
# U+00E2 U+20AC U+7C (0x7C = |)  ->  this was U+2026 (ellipsis …)
# but the | replaced U+00A6 which was the last byte of the sequence
# Original: U+00E2 U+20AC U+00A6 = ellipsis (…)
# After our fix: U+00E2 U+20AC U+7C  (we turned U+00A6 into |)
# Fix: U+00E2 U+20AC + | -> ellipsis ...
text = text.replace('\u00e2\u20ac|', '...')

# Also fix the \u00B7 sequences that might still be literal
# U+00E2 U+20AC U+00B7 -> not present but check
# U+00B7 alone is fine (middle dot)

after = sum(1 for c in text if ord(c) > 127)
print(f"Non-ASCII after final fix: {after}")
chars = {}
for c in text:
    if ord(c) > 127:
        chars[c] = chars.get(c, 0) + 1
for c, n in sorted(chars.items(), key=lambda x: ord(x[0])):
    print(f"  U+{ord(c):04X}: {n}")

with open('lrfdscript.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Saved.")
