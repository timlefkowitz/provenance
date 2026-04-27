import subprocess, sys

REPO = "/vercel/share/v0-project"

def run(cmd):
    print(f"> {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=REPO, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise SystemExit(f"Command failed with exit code {result.returncode}")

files = [
    "src/lib/valuation/compute-valuation-inputs.ts",
    "src/app/artworks/[id]/_actions/request-provenance-valuation.ts",
]

run("git add " + " ".join(f'"{f}"' for f in files))

message = (
    "fix(valuation): surface real failure reason via discriminated union\n\n"
    "Replace the opaque 'Could not compute valuation inputs' error with a\n"
    "discriminated union return type on computeValuationInputs so every\n"
    "failure path (bad DB query, artwork not found, unexpected exception)\n"
    "captures and forwards a human-readable reason string to the client.\n\n"
    "Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"
)

run(f'git commit -m "{message}"')
run("git push origin provenance-valuation-error")

print("Done — changes pushed to provenance-valuation-error")
