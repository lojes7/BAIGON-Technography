#!/usr/bin/env python3
"""将职业与专业源数据转换为 PostgreSQL 可重复执行的批量导入 SQL。"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any, TextIO


ROOT_DIR = Path(__file__).resolve().parents[1]


def read_csv(filename: str) -> list[dict[str, str]]:
    """读取 UTF-8 CSV，并保留编码字段的前导零。"""
    with (ROOT_DIR / filename).open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def assert_unique_codes(rows: Iterable[dict[str, Any]], label: str) -> None:
    """导入前校验业务编码，避免唯一索引冲突造成半成品数据。"""
    codes = [str(row["code"]) for row in rows]
    if not codes or any(not code for code in codes):
        raise ValueError(f"{label} 含空编码")
    if len(codes) != len(set(codes)):
        raise ValueError(f"{label} 含重复编码")


def assert_column_lengths(
    rows: Iterable[dict[str, Any]], label: str, code_key: str = "code", name_key: str = "name"
) -> None:
    """在生成 SQL 前验证 varchar 字段长度，避免导入时才发生事务回滚。"""
    too_long_codes = [str(row[code_key]) for row in rows if len(str(row[code_key])) > 16]
    too_long_names = [str(row[name_key]) for row in rows if len(str(row[name_key])) > 64]
    if too_long_codes:
        raise ValueError(f"{label} 存在超过 16 个字符的编码：{too_long_codes[0]}")
    if too_long_names:
        raise ValueError(f"{label} 存在超过 64 个字符的名称：{too_long_names[0]}")


def flatten_occupations(tree: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    """将 dadian 的四层树展开，并保留每一层对应的父级编码。"""
    levels: dict[int, list[dict[str, Any]]] = {1: [], 2: [], 3: [], 4: []}

    def visit(node: dict[str, Any], depth: int, parent_code: str | None) -> None:
        if depth > 4:
            raise ValueError(f"职业分类深度超过四层：{node.get('sn')}")
        code = node.get("sn")
        name = node.get("name")
        if not isinstance(code, str) or not code or not isinstance(name, str) or not name:
            raise ValueError(f"职业节点缺少 sn 或 name：{node}")

        # sn 在四层节点中均存在且唯一，作为数据库 code 的唯一来源。
        levels[depth].append(
            {
                "code": code,
                "name": name,
                "description": node.get("desc") or None,
                "parent_code": parent_code,
            }
        )
        for child in node.get("subclass") or []:
            if not isinstance(child, dict):
                raise ValueError(f"职业节点 subclass 不是对象：{code}")
            visit(child, depth + 1, code)

    for root in tree:
        visit(root, 1, None)

    for depth, rows in levels.items():
        assert_unique_codes(rows, f"职业分类第 {depth} 层")
        assert_column_lengths(rows, f"职业分类第 {depth} 层")
    return levels


def write_copy_block(
    output: TextIO,
    table_name: str,
    columns: list[str],
    rows: Iterable[tuple[Any, ...]],
) -> None:
    """使用 COPY FROM STDIN 写入临时表，避免逐行 INSERT 的性能开销。"""
    output.write(
        f"COPY {table_name} ({', '.join(columns)}) FROM STDIN WITH (FORMAT csv, NULL '\\N');\n"
    )
    writer = csv.writer(output, lineterminator="\n")
    for row in rows:
        # PostgreSQL COPY 的未加引号 \\N 表示 SQL NULL。
        writer.writerow(["\\N" if value is None else value for value in row])
    output.write("\\.\n\n")


def write_sql(output: TextIO) -> dict[str, int]:
    """构建临时表、COPY 数据块与幂等 upsert 语句。"""
    disciplines = read_csv("discipline_categories.csv")
    major_categories = read_csv("major_categories.csv")
    majors = read_csv("majors.csv")
    with (ROOT_DIR / "dadian.json").open(encoding="utf-8") as source:
        occupation_tree = json.load(source)

    if not isinstance(occupation_tree, list):
        raise ValueError("dadian.json 根节点必须是数组")

    discipline_rows = [
        {"id": index, "code": row["discipline_code"], "name": row["discipline_name"]}
        for index, row in enumerate(disciplines, start=1)
    ]
    assert_unique_codes(discipline_rows, "学科门类")
    assert_column_lengths(discipline_rows, "学科门类")
    discipline_ids = {row["code"]: row["id"] for row in discipline_rows}

    major_category_rows = []
    for index, row in enumerate(major_categories, start=1):
        discipline_code = row["discipline_code"]
        if discipline_code not in discipline_ids:
            raise ValueError(f"专业类引用了不存在的学科门类：{discipline_code}")
        major_category_rows.append(
            {
                "id": index,
                "code": row["major_category_code"],
                "name": row["major_category_name"],
                "discipline_category_id": discipline_ids[discipline_code],
            }
        )
    assert_unique_codes(major_category_rows, "专业类")
    assert_column_lengths(major_category_rows, "专业类")
    major_category_ids = {row["code"]: row["id"] for row in major_category_rows}

    major_rows = []
    for index, row in enumerate(majors, start=1):
        category_code = row["major_category_code"]
        if category_code not in major_category_ids:
            raise ValueError(f"专业引用了不存在的专业类：{category_code}")
        major_rows.append(
            {
                "id": index,
                "code": row["major_code"],
                "name": row["major_name"],
                "major_category_id": major_category_ids[category_code],
            }
        )
    assert_unique_codes(major_rows, "专业")
    assert_column_lengths(major_rows, "专业")

    occupation_levels = flatten_occupations(occupation_tree)
    occupation_rows: dict[int, list[dict[str, Any]]] = {}
    level_ids: dict[int, dict[str, int]] = {}
    for depth in range(1, 5):
        rows = []
        for index, row in enumerate(occupation_levels[depth], start=1):
            loaded = {"id": index, **row}
            if depth > 1:
                parent_id = level_ids[depth - 1].get(str(row["parent_code"]))
                if parent_id is None:
                    raise ValueError(f"职业节点找不到父级：{row['code']}")
                loaded["parent_id"] = parent_id
            rows.append(loaded)
        occupation_rows[depth] = rows
        level_ids[depth] = {str(row["code"]): int(row["id"]) for row in rows}

    output.write(
        "-- 此文件由 scripts/generate_seed_sql.py 自动生成，请勿手动编辑。\n"
        "-- 数据源：discipline_categories.csv、major_categories.csv、majors.csv、dadian.json。\n\n"
        "BEGIN;\n\n"
        "CREATE TEMP TABLE seed_discipline_categories (id bigint, code varchar(16), name varchar(64)) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_major_categories (id bigint, code varchar(16), name varchar(64), discipline_category_id bigint) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_majors (id bigint, code varchar(16), name varchar(64), major_category_id bigint) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_occupation_major_categories (id bigint, code varchar(16), name varchar(64), description text) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_occupation_sub_categories (id bigint, code varchar(16), name varchar(64), occupation_major_category_id bigint, description text) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_occupation_categories (id bigint, code varchar(16), name varchar(64), occupation_sub_category_id bigint, description text) ON COMMIT DROP;\n"
        "CREATE TEMP TABLE seed_occupations (id bigint, code varchar(16), name varchar(64), occupation_category_id bigint, description text) ON COMMIT DROP;\n\n"
    )

    write_copy_block(
        output,
        "seed_discipline_categories",
        ["id", "code", "name"],
        ((row["id"], row["code"], row["name"]) for row in discipline_rows),
    )
    write_copy_block(
        output,
        "seed_major_categories",
        ["id", "code", "name", "discipline_category_id"],
        (
            (row["id"], row["code"], row["name"], row["discipline_category_id"])
            for row in major_category_rows
        ),
    )
    write_copy_block(
        output,
        "seed_majors",
        ["id", "code", "name", "major_category_id"],
        (
            (row["id"], row["code"], row["name"], row["major_category_id"])
            for row in major_rows
        ),
    )
    write_copy_block(
        output,
        "seed_occupation_major_categories",
        ["id", "code", "name", "description"],
        ((row["id"], row["code"], row["name"], row["description"]) for row in occupation_rows[1]),
    )
    write_copy_block(
        output,
        "seed_occupation_sub_categories",
        ["id", "code", "name", "occupation_major_category_id", "description"],
        (
            (row["id"], row["code"], row["name"], row["parent_id"], row["description"])
            for row in occupation_rows[2]
        ),
    )
    write_copy_block(
        output,
        "seed_occupation_categories",
        ["id", "code", "name", "occupation_sub_category_id", "description"],
        (
            (row["id"], row["code"], row["name"], row["parent_id"], row["description"])
            for row in occupation_rows[3]
        ),
    )
    write_copy_block(
        output,
        "seed_occupations",
        ["id", "code", "name", "occupation_category_id", "description"],
        (
            (row["id"], row["code"], row["name"], row["parent_id"], row["description"])
            for row in occupation_rows[4]
        ),
    )

    output.write(
        "INSERT INTO discipline_categories (id, code, name)\n"
        "SELECT id, code, name FROM seed_discipline_categories\n"
        "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now();\n\n"
        "INSERT INTO major_categories (id, code, name, discipline_category_id)\n"
        "SELECT id, code, name, discipline_category_id FROM seed_major_categories\n"
        "ON CONFLICT (code) DO UPDATE SET\n"
        "  name = EXCLUDED.name, discipline_category_id = EXCLUDED.discipline_category_id, updated_at = now();\n\n"
        "INSERT INTO majors (id, code, name, major_category_id)\n"
        "SELECT id, code, name, major_category_id FROM seed_majors\n"
        "ON CONFLICT (code) DO UPDATE SET\n"
        "  name = EXCLUDED.name, major_category_id = EXCLUDED.major_category_id, updated_at = now();\n\n"
        "INSERT INTO occupation_major_categories (id, code, name, description)\n"
        "SELECT id, code, name, description FROM seed_occupation_major_categories\n"
        "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();\n\n"
        "INSERT INTO occupation_sub_categories (id, code, name, occupation_major_category_id, description)\n"
        "SELECT id, code, name, occupation_major_category_id, description FROM seed_occupation_sub_categories\n"
        "ON CONFLICT (code) DO UPDATE SET\n"
        "  name = EXCLUDED.name, occupation_major_category_id = EXCLUDED.occupation_major_category_id,\n"
        "  description = EXCLUDED.description, updated_at = now();\n\n"
        "INSERT INTO occupation_categories (id, code, name, occupation_sub_category_id, description)\n"
        "SELECT id, code, name, occupation_sub_category_id, description FROM seed_occupation_categories\n"
        "ON CONFLICT (code) DO UPDATE SET\n"
        "  name = EXCLUDED.name, occupation_sub_category_id = EXCLUDED.occupation_sub_category_id,\n"
        "  description = EXCLUDED.description, updated_at = now();\n\n"
        "INSERT INTO occupations (id, code, name, occupation_category_id, description)\n"
        "SELECT id, code, name, occupation_category_id, description FROM seed_occupations\n"
        "ON CONFLICT (code) DO UPDATE SET\n"
        "  name = EXCLUDED.name, occupation_category_id = EXCLUDED.occupation_category_id,\n"
        "  description = EXCLUDED.description, updated_at = now();\n\n"
        "COMMIT;\n"
    )

    return {
        "discipline_categories": len(discipline_rows),
        "major_categories": len(major_category_rows),
        "majors": len(major_rows),
        "occupation_major_categories": len(occupation_rows[1]),
        "occupation_sub_categories": len(occupation_rows[2]),
        "occupation_categories": len(occupation_rows[3]),
        "occupations": len(occupation_rows[4]),
    }


def main() -> None:
    """生成 data.sql，并在控制台输出已校验的记录数。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT_DIR / "data.sql",
        help="生成的 SQL 文件路径（默认 occupation/data.sql）",
    )
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with args.output.open("w", encoding="utf-8", newline="") as output:
        counts = write_sql(output)

    print("已生成批量导入 SQL：", args.output)
    print("；".join(f"{table}={count}" for table, count in counts.items()))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, csv.Error, json.JSONDecodeError) as exc:
        print(f"生成职业种子数据失败：{exc}", file=sys.stderr)
        raise SystemExit(1) from exc
