import importlib.util

for name in ["bark", "transformers", "torch", "scipy", "soundfile", "numpy"]:
    print(f"{name}: {bool(importlib.util.find_spec(name))}")
