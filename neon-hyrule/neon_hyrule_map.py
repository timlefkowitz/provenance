"""
Neon Hyrule - procedural open-world island map generator for Blender 4.x

Run inside Blender (Scripting tab > Open > Run Script), or headless:

    blender --background --python neon_hyrule_map.py

Generates a fully textured island (~14 km across, 1 Blender unit = 100 m):
  - Central mountain range (Cascade Highlands) with waterfalls + ancient neon ruins
  - Neon Docks (coastal cyberpunk city, SE) and The Sprawl (downtown high-rises, SW)
  - Sunbaked Flats desert (NE), The Green Belt forest (NW)
  - Small towns, ring road, elevated monorail between the two cities
  - Procedural materials only (no image files), sunset lighting, bloom
Saves neon_hyrule.blend and renders preview.png next to this script.
"""

import math
import os
import random

import bpy
from mathutils import Vector, noise

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
SEED = 42
R_ISLAND = 70.0          # island radius in units (1 unit = 100 m)
GRID_SIZE = 170.0        # terrain plane size
GRID_RES = 380           # subdivisions per side
WATER_Z = 0.0

# City definitions: (name, cx, cy, radius, ground height)
CITIES = [
    ("Neon Docks", 38.0, -38.0, 13.0, 0.55),   # SE coast
    ("The Sprawl", -36.0, -30.0, 12.0, 1.0),   # SW inland
]

# Towns: (name, cx, cy)
TOWNS = [
    ("Dusty Junction", 42.0, 28.0),     # desert NE
    ("Mesa Verde", 22.0, 50.0),         # desert N
    ("Mosswood", -44.0, 24.0),          # forest NW
    ("Riverside", -20.0, 48.0),         # forest N
    ("Palm Row", 2.0, -52.0),           # south coast
    ("Switchback", -52.0, -6.0),        # west
]

random.seed(SEED)


def log(msg):
    print(f"[NeonHyrule] {msg}")


# ----------------------------------------------------------------------------
# Height field
# ----------------------------------------------------------------------------
def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def fbm(x, y, freq=1.0, octaves=5, gain=0.5, lac=2.0, zoff=0.0):
    amp, f, total, norm = 1.0, freq, 0.0, 0.0
    for _ in range(octaves):
        total += amp * noise.noise(Vector((x * f, y * f, zoff)))
        norm += amp
        amp *= gain
        f *= lac
    return total / norm


_town_grounds = None  # (cx, cy, ground_h) resolved lazily


def height_base(x, y):
    """Terrain height before city/town flattening."""
    d = math.hypot(x, y)
    island = 1.0 - smoothstep(0.78, 1.0, d / R_ISLAND)
    hills = fbm(x, y, freq=0.035, octaves=5, zoff=3.7) * 1.6
    ridge_n = fbm(x, y, freq=0.032, octaves=4, zoff=11.3)
    ridge = (1.0 - abs(ridge_n)) ** 2.4
    peaks = 0.7 + 0.5 * fbm(x, y, freq=0.05, octaves=3, zoff=29.1)
    mountains = ridge * peaks * 24.0 * math.exp(-((d / 24.0) ** 2))
    h = (2.4 + hills + mountains) * island - 1.1
    return h


def height(x, y):
    """Final terrain height including flattened city/town pads."""
    global _town_grounds
    if _town_grounds is None:
        _town_grounds = [(cx, cy, max(0.35, height_base(cx, cy)))
                         for _, cx, cy in TOWNS]
    h = height_base(x, y)
    for _, cx, cy, rad, gh in CITIES:
        w = 1.0 - smoothstep(rad * 0.55, rad, math.hypot(x - cx, y - cy))
        h = h * (1.0 - w) + gh * w
    for cx, cy, gh in _town_grounds:
        w = 1.0 - smoothstep(2.5, 5.0, math.hypot(x - cx, y - cy))
        h = h * (1.0 - w) + gh * w
    return h


def in_city(x, y):
    for name, cx, cy, rad, gh in CITIES:
        if math.hypot(x - cx, y - cy) < rad:
            return name
    return None


# ----------------------------------------------------------------------------
# Scene reset & collections
# ----------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


# ----------------------------------------------------------------------------
# Material helpers (procedural only)
# ----------------------------------------------------------------------------
def new_material(name, base=(0.5, 0.5, 0.5, 1), rough=0.85, metal=0.0,
                 emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = emit
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def noisy_material(name, col_a, col_b, scale=8.0, rough=0.9):
    """Two colors blended by a noise texture - good for natural ground."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = col_a
    ramp.color_ramp.elements[1].color = col_b
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def rock_snow_material():
    """Gray rock that fades to snow above z ~ 7 (object space)."""
    mat = bpy.data.materials.new("Highlands Rock")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = 11.0
    rng.inputs["From Max"].default_value = 14.5
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.inputs["A"].default_value = (0.09, 0.08, 0.10, 1)   # rock
    mix.inputs["B"].default_value = (0.85, 0.90, 1.0, 1)    # snow
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 5.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def water_material():
    mat = bpy.data.materials.new("Ocean")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.02, 0.10, 0.18, 1)
    bsdf.inputs["Roughness"].default_value = 0.05
    bsdf.inputs["Metallic"].default_value = 0.3
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 60.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def building_material(name, neon_rgba):
    """Dark concrete tower with emissive neon window grid."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.03, 0.03, 0.04, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (7.0, 7.0, 12.0)
    checker = nt.nodes.new("ShaderNodeTexChecker")
    checker.inputs["Color1"].default_value = (1, 1, 1, 1)
    checker.inputs["Color2"].default_value = (0, 0, 0, 1)
    checker.inputs["Scale"].default_value = 1.0
    # Random on/off per window cell so towers aren't uniformly lit
    cellnoise = nt.nodes.new("ShaderNodeTexWhiteNoise")
    cellnoise.noise_dimensions = '3D'
    snap = nt.nodes.new("ShaderNodeVectorMath")
    snap.operation = 'SNAP'
    snap.inputs[1].default_value = (1 / 7.0, 1 / 7.0, 1 / 12.0)
    gate = nt.nodes.new("ShaderNodeMath")
    gate.operation = 'GREATER_THAN'
    gate.inputs[1].default_value = 0.45
    lit = nt.nodes.new("ShaderNodeMath")
    lit.operation = 'MULTIPLY'
    boost = nt.nodes.new("ShaderNodeMath")
    boost.operation = 'MULTIPLY'
    boost.inputs[1].default_value = 4.0
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], checker.inputs["Vector"])
    nt.links.new(coord.outputs["Object"], snap.inputs[0])
    nt.links.new(snap.outputs["Vector"], cellnoise.inputs["Vector"])
    nt.links.new(cellnoise.outputs["Value"], gate.inputs[0])
    nt.links.new(checker.outputs["Fac"], lit.inputs[0])
    nt.links.new(gate.outputs["Value"], lit.inputs[1])
    bsdf.inputs["Emission Color"].default_value = neon_rgba
    nt.links.new(lit.outputs["Value"], boost.inputs[0])
    nt.links.new(boost.outputs["Value"], bsdf.inputs["Emission Strength"])
    return mat


def rune_stone_material():
    """Ancient stone with glowing cyan rune bands (Zelda ruins + tech)."""
    mat = bpy.data.materials.new("Rune Stone")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.28, 0.27, 0.24, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 9.0
    wave.wave_profile = 'SAW'
    gate = nt.nodes.new("ShaderNodeMath")
    gate.operation = 'GREATER_THAN'
    gate.inputs[1].default_value = 0.88
    strength = nt.nodes.new("ShaderNodeMath")
    strength.operation = 'MULTIPLY'
    strength.inputs[1].default_value = 6.0
    bsdf.inputs["Emission Color"].default_value = (0.1, 0.9, 1.0, 1)
    nt.links.new(wave.outputs["Fac"], gate.inputs[0])
    nt.links.new(gate.outputs["Value"], strength.inputs[0])
    nt.links.new(strength.outputs["Value"], bsdf.inputs["Emission Strength"])
    return mat


# ----------------------------------------------------------------------------
# Terrain
# ----------------------------------------------------------------------------
def build_terrain(col):
    log("Building terrain grid...")
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=GRID_RES,
                                    y_subdivisions=GRID_RES,
                                    size=GRID_SIZE)
    obj = bpy.context.active_object
    obj.name = "Island Terrain"
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)

    me = obj.data
    for v in me.vertices:
        v.co.z = height(v.co.x, v.co.y)

    # Materials: 0 grass (Green Belt), 1 desert, 2 rock, 3 asphalt,
    #            4 beach, 5 urban outskirts
    mats = [
        noisy_material("Green Belt Grass", (0.03, 0.14, 0.03, 1),
                       (0.08, 0.30, 0.07, 1), scale=10),
        noisy_material("Sunbaked Sand", (0.55, 0.36, 0.16, 1),
                       (0.78, 0.58, 0.30, 1), scale=7),
        rock_snow_material(),
        noisy_material("City Asphalt", (0.02, 0.02, 0.025, 1),
                       (0.06, 0.06, 0.07, 1), scale=25, rough=0.7),
        noisy_material("Beach Sand", (0.80, 0.68, 0.44, 1),
                       (0.90, 0.80, 0.58, 1), scale=12),
        noisy_material("Urban Scrub", (0.08, 0.16, 0.05, 1),
                       (0.22, 0.24, 0.10, 1), scale=9),
    ]
    for m in mats:
        me.materials.append(m)

    log("Assigning biome materials...")
    for poly in me.polygons:
        cx, cy, cz = poly.center
        d = math.hypot(cx, cy)
        if in_city(cx, cy) and cz > 0.2:
            poly.material_index = 3
        elif cz > 4.5:
            poly.material_index = 2                       # highlands rock
        elif cz < 0.32:
            poly.material_index = 4                       # beach / seabed
        else:
            theta = math.degrees(math.atan2(cy, cx))
            if 5 <= theta <= 95:
                poly.material_index = 1                   # desert NE
            elif 95 < theta <= 185:
                poly.material_index = 0                   # forest NW
            else:
                poly.material_index = 5                   # urban south belt
    me.update()
    obj.data.shade_smooth()
    return obj


def build_water(col):
    bpy.ops.mesh.primitive_plane_add(size=GRID_SIZE * 12.0,
                                     location=(0, 0, WATER_Z))
    obj = bpy.context.active_object
    obj.name = "Ocean"
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    obj.data.materials.append(water_material())
    return obj


# ----------------------------------------------------------------------------
# Mesh helpers
# ----------------------------------------------------------------------------
def mesh_object(name, verts, faces, mat, col):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if mat:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def build_ribbon(name, pts, width, mat, col):
    """Flat ribbon mesh following a list of Vector points (roads, rails)."""
    verts, faces = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        if i == 0:
            d = pts[1] - p
        elif i == n - 1:
            d = p - pts[i - 1]
        else:
            d = pts[i + 1] - pts[i - 1]
        d.z = 0
        if d.length < 1e-6:
            d = Vector((1, 0, 0))
        d.normalize()
        side = Vector((-d.y, d.x, 0)) * (width * 0.5)
        verts += [p + side, p - side]
        if i > 0:
            a = 2 * i
            faces.append((a - 2, a - 1, a + 1, a))
    return mesh_object(name, verts, faces, mat, col)


def add_box(name, x, y, z, sx, sy, sz, mat, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + sz / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


# ----------------------------------------------------------------------------
# Cities, towns, props
# ----------------------------------------------------------------------------
def build_cities(col):
    log("Building the two cities...")
    neon_palettes = [
        building_material("Tower Cyan", (0.1, 0.9, 1.0, 1)),
        building_material("Tower Magenta", (1.0, 0.15, 0.8, 1)),
        building_material("Tower Purple", (0.55, 0.2, 1.0, 1)),
        building_material("Tower Amber", (1.0, 0.55, 0.1, 1)),
    ]
    sign_mats = [
        new_material("Neon Sign Cyan", (0, 0, 0, 1),
                     emit=(0.1, 0.95, 1.0, 1), emit_strength=12),
        new_material("Neon Sign Pink", (0, 0, 0, 1),
                     emit=(1.0, 0.2, 0.75, 1), emit_strength=12),
    ]
    for name, cx, cy, rad, gh in CITIES:
        tall = 4.5 if name == "The Sprawl" else 3.2
        count = 90
        placed = 0
        attempts = 0
        while placed < count and attempts < count * 8:
            attempts += 1
            ang = random.uniform(0, 2 * math.pi)
            r = rad * 0.92 * math.sqrt(random.random())
            x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
            gz = height(x, y)
            if gz < 0.25:            # keep towers off the water
                continue
            core = (1.0 - (r / rad)) ** 1.5   # taller towards downtown core
            h = random.uniform(0.3, 0.7) + core * random.uniform(1.2, tall)
            fp = random.uniform(0.4, 0.9)
            mat = random.choice(neon_palettes)
            b = add_box(f"{name} Tower", x, y, gz, fp,
                        fp * random.uniform(0.7, 1.3), h, mat, col)
            if h > 1.6 and random.random() < 0.5:
                add_box("Neon Sign", x, y, gz + h + 0.05,
                        fp * 0.8, 0.06, 0.22,
                        random.choice(sign_mats), col)
            placed += 1
        log(f"  {name}: {placed} towers")


def build_towns(col):
    log("Building small towns...")
    wall = noisy_material("Town Wall", (0.35, 0.30, 0.26, 1),
                          (0.55, 0.48, 0.40, 1), scale=14)
    window = new_material("Warm Window", (0.05, 0.04, 0.03, 1),
                          emit=(1.0, 0.6, 0.25, 1), emit_strength=4)
    for name, cx, cy in TOWNS:
        gz_c = height(cx, cy)
        if gz_c < 0.2:
            continue
        for _ in range(random.randint(9, 14)):
            ang = random.uniform(0, 2 * math.pi)
            r = 3.5 * math.sqrt(random.random())
            x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
            gz = height(x, y)
            if gz < 0.2:
                continue
            s = random.uniform(0.25, 0.45)
            add_box(f"{name} House", x, y, gz, s,
                    s * random.uniform(0.8, 1.4),
                    random.uniform(0.12, 0.22), wall, col)
        # one glowing town beacon (fast-travel point)
        add_box(f"{name} Beacon", cx, cy, gz_c, 0.12, 0.12, 0.9, window, col)


def build_forest(col):
    log("Scattering the Green Belt forest...")
    trunk = new_material("Trunk", (0.20, 0.11, 0.05, 1))
    leaf = noisy_material("Foliage", (0.02, 0.18, 0.04, 1),
                          (0.06, 0.32, 0.10, 1), scale=6)
    # Template tree: cylinder trunk + icosphere canopy, then copy (shared mesh)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.22,
                                        location=(0, 0, -100))
    trunk_t = bpy.context.active_object
    trunk_t.data.materials.append(trunk)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.16, subdivisions=1,
                                          location=(0, 0, -100))
    leaf_t = bpy.context.active_object
    leaf_t.data.materials.append(leaf)

    count = 0
    for _ in range(2000):
        if count >= 350:
            break
        ang = math.radians(random.uniform(97, 183))
        r = random.uniform(26, 62)
        x, y = r * math.cos(ang), r * math.sin(ang)
        gz = height(x, y)
        if gz < 0.5 or gz > 4.5 or in_city(x, y):
            continue
        s = random.uniform(0.8, 1.8)
        t = trunk_t.copy()
        t.location = (x, y, gz + 0.11 * s)
        t.scale = (s, s, s)
        col.objects.link(t)
        c = leaf_t.copy()
        c.location = (x, y, gz + (0.22 + 0.10) * s)
        c.scale = (s, s, s * 1.2)
        col.objects.link(c)
        count += 1
    for tmp in (trunk_t, leaf_t):
        for c in tmp.users_collection:
            c.objects.unlink(tmp)
        col.objects.link(tmp)
        tmp.hide_render = True
        tmp.hide_viewport = True
    log(f"  {count} trees")


def build_desert_props(col):
    cactus = new_material("Cactus", (0.10, 0.30, 0.12, 1), rough=0.8)
    count = 0
    for _ in range(600):
        if count >= 80:
            break
        ang = math.radians(random.uniform(8, 92))
        r = random.uniform(28, 62)
        x, y = r * math.cos(ang), r * math.sin(ang)
        gz = height(x, y)
        if gz < 0.5 or gz > 4.0 or in_city(x, y):
            continue
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.05, depth=random.uniform(0.25, 0.5),
            location=(x, y, gz + 0.15))
        obj = bpy.context.active_object
        obj.name = "Cactus"
        for c in obj.users_collection:
            c.objects.unlink(obj)
        col.objects.link(obj)
        obj.data.materials.append(cactus)
        count += 1


def build_ruins(col):
    log("Placing ancient neon ruins in the Highlands...")
    stone = rune_stone_material()
    sites = [(6.0, 14.0), (-11.0, 4.0), (4.0, -12.0)]
    for sx, sy in sites:
        gz = height(sx, sy)
        for i in range(8):
            a = i / 8 * 2 * math.pi
            x, y = sx + 1.6 * math.cos(a), sy + 1.6 * math.sin(a)
            bpy.ops.mesh.primitive_cylinder_add(
                radius=0.18, depth=1.4, location=(x, y, height(x, y) + 0.7))
            p = bpy.context.active_object
            p.name = "Ruin Pillar"
            if random.random() < 0.3:   # a few toppled pillars
                p.rotation_euler = (random.uniform(0.8, 1.4), 0,
                                    random.uniform(0, 6.28))
            for c in p.users_collection:
                c.objects.unlink(p)
            col.objects.link(p)
            p.data.materials.append(stone)
        add_box("Rune Altar", sx, sy, gz, 0.8, 0.8, 0.5, stone, col)


def build_shrines(col):
    glow = new_material("Shrine Glow", (0.05, 0.05, 0.08, 1),
                        emit=(1.0, 0.5, 0.1, 1), emit_strength=8)
    stone = new_material("Shrine Stone", (0.20, 0.20, 0.24, 1), rough=0.9)
    spots = [(-38.0, 40.0), (-52.0, 18.0), (-24.0, 34.0)]
    for x, y in spots:
        gz = height(x, y)
        if gz < 0.3:
            continue
        add_box("Shrine Base", x, y, gz, 0.9, 0.9, 0.35, stone, col)
        bpy.ops.mesh.primitive_cone_add(radius1=0.35, depth=0.6,
                                        location=(x, y, gz + 0.35 + 0.3))
        c = bpy.context.active_object
        c.name = "Shrine Spire"
        for cc in c.users_collection:
            cc.objects.unlink(c)
        col.objects.link(c)
        c.data.materials.append(glow)


def build_waterfalls(col):
    log("Adding waterfalls...")
    mat = new_material("Waterfall", (0.75, 0.88, 1.0, 1), rough=0.15,
                       emit=(0.8, 0.9, 1.0, 1), emit_strength=0.6)
    for ang_deg in (150, 250):
        a = math.radians(ang_deg)
        pts = []
        for t in range(14):
            r = 8.0 + t * 1.6
            x, y = r * math.cos(a), r * math.sin(a)
            pts.append(Vector((x, y, max(height(x, y) + 0.12, WATER_Z + 0.05))))
        build_ribbon(f"Waterfall {ang_deg}", pts, 1.0, mat, col)


# ----------------------------------------------------------------------------
# Infrastructure: ring road + monorail
# ----------------------------------------------------------------------------
def build_ring_road(col):
    log("Paving the ring road...")
    mat = noisy_material("Road Asphalt", (0.015, 0.015, 0.02, 1),
                         (0.05, 0.05, 0.06, 1), scale=30, rough=0.6)
    pts = []
    steps = 180
    for i in range(steps + 1):
        a = i / steps * 2 * math.pi
        r = 46.0 + fbm(math.cos(a) * 3, math.sin(a) * 3, freq=0.5,
                       octaves=2, zoff=77.0) * 5.0
        x, y = r * math.cos(a), r * math.sin(a)
        z = max(height(x, y) + 0.08, WATER_Z + 0.25)  # causeway over inlets
        pts.append(Vector((x, y, z)))
    build_ribbon("Ring Road", pts, 0.9, mat, col)


def build_monorail(col):
    log("Building the monorail between the two cities...")
    rail = new_material("Monorail Track", (0.05, 0.05, 0.07, 1), rough=0.4,
                        metal=0.6, emit=(0.1, 0.9, 1.0, 1), emit_strength=2.5)
    pillar = new_material("Monorail Pillar", (0.12, 0.12, 0.14, 1), rough=0.7)
    a_city, b_city = CITIES[0], CITIES[1]
    ax, ay = a_city[1], a_city[2]
    bx, by = b_city[1], b_city[2]
    pts = []
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = ax + (bx - ax) * t
        y = ay + (by - ay) * t
        # bow the line south so it skirts the mountains
        y -= math.sin(t * math.pi) * 14.0
        z = max(height(x, y), WATER_Z) + 1.4
        pts.append(Vector((x, y, z)))
    build_ribbon("Monorail", pts, 0.35, rail, col)
    for i in range(0, steps + 1, 6):
        p = pts[i]
        gz = max(height(p.x, p.y), WATER_Z - 0.5)
        depth = p.z - gz
        bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=depth,
                                            location=(p.x, p.y,
                                                      gz + depth / 2))
        obj = bpy.context.active_object
        obj.name = "Monorail Pillar"
        for c in obj.users_collection:
            c.objects.unlink(obj)
        col.objects.link(obj)
        obj.data.materials.append(pillar)


# ----------------------------------------------------------------------------
# Lighting, world, camera, render settings
# ----------------------------------------------------------------------------
def setup_world_and_light(col):
    log("Setting up sunset lighting...")
    world = bpy.data.worlds.new("Neon Dusk")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    try:
        sky = nt.nodes.new("ShaderNodeTexSky")
        sky.sky_type = 'NISHITA'
        sky.sun_elevation = math.radians(6.0)
        sky.sun_rotation = math.radians(140.0)
        sky.sun_intensity = 0.25
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.4
    except Exception as exc:  # older Blender fallback
        print(f"[NeonHyrule] Sky texture failed ({exc}); using flat dusk color")
        bg.inputs["Color"].default_value = (0.045, 0.02, 0.09, 1)
        bg.inputs["Strength"].default_value = 0.8

    sun_data = bpy.data.lights.new("Sun", type='SUN')
    sun_data.energy = 2.5
    sun_data.color = (1.0, 0.55, 0.30)          # golden-hour warmth
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(78), 0, math.radians(140))
    col.objects.link(sun)

    fill_data = bpy.data.lights.new("Cool Fill", type='SUN')
    fill_data.energy = 0.4
    fill_data.color = (0.35, 0.45, 1.0)         # cyberpunk cool bounce
    fill = bpy.data.objects.new("Cool Fill", fill_data)
    fill.rotation_euler = (math.radians(60), 0, math.radians(-40))
    col.objects.link(fill)


def setup_camera(col):
    cam_data = bpy.data.cameras.new("Overview Cam")
    cam_data.lens = 32
    cam = bpy.data.objects.new("Overview Cam", cam_data)
    cam.location = Vector((92, -108, 62))
    direction = Vector((0, 6, 2)) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    col.objects.link(cam)
    bpy.context.scene.camera = cam


def setup_render(out_png):
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.filepath = out_png
    # Bloom via compositor glare so the neon pops
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = 'FOG_GLOW'
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], comp.inputs["Image"])


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    log("Starting map generation")
    reset_scene()

    terrain_col = make_collection("Terrain")
    water_col = make_collection("Water")
    cities_col = make_collection("Cities")
    towns_col = make_collection("Towns")
    nature_col = make_collection("Nature")
    landmarks_col = make_collection("Landmarks")
    infra_col = make_collection("Infrastructure")
    setup_col = make_collection("Camera & Light")

    build_terrain(terrain_col)
    build_water(water_col)
    build_cities(cities_col)
    build_towns(towns_col)
    build_forest(nature_col)
    build_desert_props(nature_col)
    build_ruins(landmarks_col)
    build_shrines(landmarks_col)
    build_waterfalls(landmarks_col)
    build_ring_road(infra_col)
    build_monorail(infra_col)
    setup_world_and_light(setup_col)
    setup_camera(setup_col)

    here = os.path.dirname(os.path.abspath(__file__))
    blend_path = os.path.join(here, "neon_hyrule.blend")
    png_path = os.path.join(here, "preview.png")
    setup_render(png_path)

    log(f"Saving {blend_path}")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    if bpy.app.background:
        log("Rendering island overview...")
        bpy.ops.render.render(write_still=True)
        log(f"Preview saved to {png_path}")

        # Second shot: street-level view of Neon Docks to show off textures
        cam = bpy.context.scene.camera
        _, cx, cy, rad, gh = CITIES[0]
        cam.location = Vector((cx + 16, cy - 20, 6.5))
        direction = Vector((cx, cy, 2.0)) - cam.location
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.render.filepath = os.path.join(here,
                                                         "preview_city.png")
        bpy.ops.render.render(write_still=True)
        log("City close-up saved to preview_city.png")
    log("Done")


main()
