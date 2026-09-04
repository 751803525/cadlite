import sys
import os
import json
import FreeCAD
import Import

def logger(msg, file=sys.stdout):
    print(msg, file=file, flush=True)

def main():
    if len(sys.argv) < 3:
        logger("错误: 缺少输入/输出路径参数", file=sys.stderr)
        logger(f"当前接收到的参数: {sys.argv}", file=sys.stderr)
        sys.exit(1)

    input_step = sys.argv[1]
    output_dir = sys.argv[2]

    logger("Python 开始处理 STEP 文件")
    logger(f"输出目标路径: {output_dir}")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    doc = FreeCAD.newDocument("STEP_Parser")
    exported_count = 0

    def serialize_matrix(matrix):
        """将 FreeCAD 矩阵转换为 4x4 扁平数组 (16个浮点数)"""
        return [
            matrix.A11, matrix.A12, matrix.A13, matrix.A14,
            matrix.A21, matrix.A22, matrix.A23, matrix.A24,
            matrix.A31, matrix.A32, matrix.A33, matrix.A34,
            matrix.A41, matrix.A42, matrix.A43, matrix.A44
        ]

    def get_safe_matrix(obj):
        """安全地获取对象的坐标变换矩阵"""
        try:
            if hasattr(obj, "getGlobalPlacement"):
                return serialize_matrix(obj.getGlobalPlacement().toMatrix())
            if hasattr(obj, "Placement"):
                return serialize_matrix(obj.Placement.toMatrix())
        except Exception:
            pass

        return [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0
        ]

    def is_object_visible(obj):
        """
        深度多重校验无 GUI 模式下的真实显隐状态
        """
        # 1. 如果存在 ViewObject 并且定义了 Visibility (GUI 视角)
        if hasattr(obj, "ViewObject") and obj.ViewObject is not None:
            if hasattr(obj.ViewObject, "Visibility") and not obj.ViewObject.Visibility:
                return False

        # 2. 直接挂载在 Data 属性上的 Visibility (针对 App::Part / App::Link)
        if hasattr(obj, "Visibility") and not getattr(obj, "Visibility"):
            return False

        # 3. 检查 App::Link / Assembly3 / Assembly4 节点的特殊显隐标记
        if hasattr(obj, "Show") and not getattr(obj, "Show"):
            return False

        # 4. 检查 FreeCAD 对象的 State 状态属性 (如果被置位为隐藏/禁用)
        if hasattr(obj, "State"):
            state = getattr(obj, "State")
            if isinstance(state, list) and ("Hidden" in state or "Disabled" in state):
                return False

        # 5. 检查 Shape 本身是否为空或无几何拓扑
        if hasattr(obj, "Shape") and (obj.Shape.isNull() or len(obj.Shape.Faces) == 0):
            return False

        return True

    def get_child_objects(obj):
        """准确提取当前节点下属的所有有效 CAD/零件子节点"""
        children = []
        if hasattr(obj, "Group") and obj.Group:
            children = list(obj.Group)
        elif hasattr(obj, "OutList") and obj.OutList:
            children = [
                child for child in obj.OutList
                if hasattr(child, "Shape") and child != obj
            ]
        return children

    def process_node(obj, parent_visible=True, visited=None):
        """递归解析装配体节点"""
        nonlocal exported_count
        if visited is None:
            visited = set()

        if obj.Name in visited:
            return None
        visited.add(obj.Name)

        current_visible = is_object_visible(obj)

        # 父级不可见 OR 自身不可见 -> 直接跳过
        if not parent_visible or not current_visible:
            logger(f"[跳过隐藏/无效节点] Label: '{obj.Label}' (Name: {obj.Name}, Type: {obj.TypeId})")
            return None

        # 安全 Label 格式化
        safe_label = "".join([c for c in obj.Label if c.isalnum() or c in (' ', '_', '-')]).strip()
        if not safe_label:
            safe_label = f"Node_{obj.Name}"

        matrix = get_safe_matrix(obj)

        node_data = {
            "id": obj.Name,
            "name": safe_label,
            "type": obj.TypeId,
            "matrix": matrix,
            "children": [],
            "fileName": None
        }

        children = get_child_objects(obj)

        # 情况 A: 装配体/容器节点
        if len(children) > 0:
            for child in children:
                # 传递当前节点的显隐状态给子节点
                child_tree = process_node(child, parent_visible=current_visible, visited=visited)
                if child_tree:
                    node_data["children"].append(child_tree)

            # 如果容器里的所有子对象都被隐藏/过滤掉了，则这个空容器也不返回
            if len(node_data["children"]) == 0 and not hasattr(obj, "Shape"):
                return None

            return node_data

        # 情况 B: 叶子零件节点
        if hasattr(obj, "Shape") and not obj.Shape.isNull():
            fileName = f"{safe_label}_{exported_count}.step"
            out_path = os.path.join(output_dir, fileName)

            obj.Shape.exportStep(out_path)
            exported_count += 1
            node_data["fileName"] = fileName
            logger(f"成功导出零件 [{exported_count}]: {fileName}")
            return node_data

        return None

    try:
        # 导入 STEP 文件
        Import.insert(input_step, doc.Name)
        logger(f"FreeCAD 导入完成，文档内对象总数: {len(doc.Objects)}")

        # 寻找顶级根节点
        all_children = set()
        for obj in doc.Objects:
            for child in get_child_objects(obj):
                all_children.add(child.Name)

        root_objs = [
            obj for obj in doc.Objects
            if obj.Name not in all_children and hasattr(obj, "Shape")
        ]

        if not root_objs:
            logger("未找到明确根节点，使用备用对象匹配逻辑...")
            root_objs = [
                obj for obj in doc.Objects
                if obj.isDerivedFrom("App::Part") or (hasattr(obj, "Shape") and not obj.Shape.isNull())
            ]

        logger(f"检测到顶级节点数量: {len(root_objs)}")

        root_nodes = []
        visited_nodes = set()

        for root in root_objs:
            tree_data = process_node(root, parent_visible=True, visited=visited_nodes)
            if tree_data:
                root_nodes.append(tree_data)

        assembly_tree = {
            "sourceFile": os.path.basename(input_step),
            "totalParts": exported_count,
            "tree": root_nodes
        }

        json_path = os.path.join(output_dir, "tree.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(assembly_tree, f, ensure_ascii=False, indent=2)

        logger(f"导出处理完成！共导出 {exported_count} 个有效零件，结构树保存至: {json_path}")

    except Exception as e:
        logger(f"处理 STEP 过程中出现异常: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    finally:
        FreeCAD.closeDocument(doc.Name)

main()
sys.exit(0)