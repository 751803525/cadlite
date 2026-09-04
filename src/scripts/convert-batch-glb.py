# src/scripts/convert-batch-glb.py
import sys
import os
import json
import struct
import FreeCAD
import Part
import MeshPart

def logger(msg,file=sys.stdout):
    print(msg,file=file,flush=True)

def export_mesh_to_glb(mesh, glb_path):
    """
    使用纯 Python 拼接符合 glTF 2.0 规范的二进制 .glb 文件 (无需任何外部插件/模块)
    """
    # 提取网格顶点与三角面索引
    if hasattr(mesh, 'Topology'):
        points, facets = mesh.Topology
    else:
        points = [p.Vector for p in mesh.Points]
        facets = [f.PointIndices for f in mesh.Facets]

    if not points or not facets:
        return False

    # 1. 构建顶点 buffer (float32 vec3)
    positions = []
    min_pos = [float('inf'), float('inf'), float('inf')]
    max_pos = [float('-inf'), float('-inf'), float('-inf')]

    for p in points:
        x, y, z = float(p.x), float(p.y), float(p.z)
        positions.extend([x, y, z])
        if x < min_pos[0]: min_pos[0] = x
        if y < min_pos[1]: min_pos[1] = y
        if z < min_pos[2]: min_pos[2] = z
        if x > max_pos[0]: max_pos[0] = x
        if y > max_pos[1]: max_pos[1] = y
        if z > max_pos[2]: max_pos[2] = z

    pos_bytes = struct.pack(f'<{len(positions)}f', *positions)

    # 2. 构建索引 buffer (uint32)
    indices = []
    for f in facets:
        indices.extend([f[0], f[1], f[2]])

    idx_bytes = struct.pack(f'<{len(indices)}I', *indices)

    # 3. 内存块 4 字节对齐
    pos_padding = (4 - (len(pos_bytes) % 4)) % 4
    pos_bytes += b'\x00' * pos_padding

    idx_padding = (4 - (len(idx_bytes) % 4)) % 4
    idx_bytes += b'\x00' * idx_padding

    bin_buffer = pos_bytes + idx_bytes

    # 4. 构造 glTF JSON 元数据结构
    pos_len = len(positions) * 4
    idx_offset = len(pos_bytes)
    idx_len = len(indices) * 4

    gltf_structure = {
        "asset": {"version": "2.0", "generator": "FreeCAD-CADLite"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{
            "primitives": [{
                "attributes": {"POSITION": 0},
                "indices": 1,
                "mode": 4  # TRIANGLES
            }]
        }],
        "buffers": [{
            "byteLength": len(bin_buffer)
        }],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": pos_len,
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": idx_offset,
                "byteLength": idx_len,
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(points),
                "type": "VEC3",
                "min": min_pos,
                "max": max_pos
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5125,  # UNSIGNED_INT
                "count": len(indices),
                "type": "SCALAR"
            }
        ]
    }

    # JSON chunk 对齐处理 (空格填充 0x20)
    json_bytes = json.dumps(gltf_structure, separators=(',', ':')).encode('utf-8')
    json_padding = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b' ' * json_padding

    # 5. 打包 Header & Chunks 写入文件
    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_buffer)

    header = struct.pack('<4sII', b'glTF', 2, total_length)
    json_chunk_hdr = struct.pack('<I4s', len(json_bytes), b'JSON')
    bin_chunk_hdr = struct.pack('<I4s', len(bin_buffer), b'BIN\x00')

    with open(glb_path, 'wb') as f:
        f.write(header)
        f.write(json_chunk_hdr)
        f.write(json_bytes)
        f.write(bin_chunk_hdr)
        f.write(bin_buffer)

    return True

def convert_single(step_path, glb_path):
    doc = None
    try:
        if not os.path.exists(step_path):
            logger(f"输入文件不存在: {step_path}")
            return False

        glb_dir = os.path.dirname(glb_path)
        if glb_dir and not os.path.exists(glb_dir):
            os.makedirs(glb_dir, exist_ok=True)

        doc = FreeCAD.newDocument("BatchDoc")
        shape = Part.Shape()
        shape.read(step_path)
        
        if shape.isNull():
            logger(f"读取 Shape 为空: {step_path}")
            return False

        # 网格离散化
        mesh = MeshPart.meshFromShape(
            Shape=shape, 
            LinearDeflection=0.15,
            AngularDeflection=0.5
        )

        if mesh.CountFacets == 0:
            logger(f"网格面数为 0: {step_path}")
            return False

        # 直接离线输出二进制标准 GLB
        success = export_mesh_to_glb(mesh, glb_path)
        return success

    except Exception as e:
        logger(f"转换异常 [{step_path}]: {str(e)}")
        return False
    finally:
        if doc:
            try:
                FreeCAD.closeDocument(doc.Name)
            except Exception:
                pass

def main():
    if len(sys.argv) < 2:
        logger("未提供批任务 JSON 参数路径" )
        sys.exit(1)

    batch_file = sys.argv[1]
    if not os.path.exists(batch_file):
        logger(f"找不到批任务文件: {batch_file}")
        sys.exit(1)

    try:
        with open(batch_file, 'r', encoding='utf-8') as f:
            tasks = json.load(f)
    except Exception as e:
        logger(f"读取 JSON 任务文件失败: {str(e)}")
        sys.exit(1)

    failed_count = 0
    total_tasks = len(tasks)

    for task in tasks:
        step_file = task.get('step')
        glb_file = task.get('glb')

        if not step_file or not glb_file:
            logger(f"任务格式无效: {task}")
            failed_count += 1
            continue

        success = convert_single(step_file, glb_file)
        if not success:
            failed_count += 1
        else:
            logger(f"零件转换成功: {os.path.basename(step_file)} => {os.path.basename(glb_file)}")

    if failed_count > 0:
        logger(f"批次处理完成，但有 {failed_count}/{total_tasks} 个零件转换失败！",sys.stdout )
        sys.exit(2)

    logger(f"批次全部 {total_tasks} 个零件转换成功。")
    sys.exit(0)

main()