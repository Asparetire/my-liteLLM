"""后端错误信息翻译模块

提供 translate_message() / get_translated_error() 纯函数，将英文错误消息翻译为中文。
未命中翻译时原样返回英文（降级安全），见 dev-plans/03-后端错误信息汉化.md。
"""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Final

LOCALE_DIR: Final = Path(__file__).parent / "locale"

_PLACEHOLDER: Final = re.compile(r"\{(\w+)\}")


@lru_cache(maxsize=8)
def load_translations(locale: str = "zh-CN") -> dict:
    """加载指定语言的翻译文件（key 为英文原文或 error.<错误码>）"""
    locale_file = LOCALE_DIR / f"{locale}.json"
    if locale_file.exists():
        with open(locale_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


@lru_cache(maxsize=512)
def _compile_template(template: str) -> "re.Pattern[str]":
    """把含 {placeholder} 的模板编译为命名分组的全匹配正则"""
    parts: list[str] = _PLACEHOLDER.split(template)
    # split 带捕获组时返回 [字面量, 组名, 字面量, 组名, ..., 字面量]
    pattern = "".join(
        re.escape(part) if index % 2 == 0 else f"(?P<{part}>.+?)"
        for index, part in enumerate(parts)
    )
    return re.compile(pattern, re.DOTALL)


def translate_message(message: str, locale: str = "zh-CN") -> str:
    """尝试将英文错误消息翻译为中文，未命中则原样返回

    匹配策略（按优先级）：
    1. 全量精确匹配：key 为英文原文（含标点）
    2. error.<错误码> 形式的 key（空格归一为下划线）
    3. 含 {placeholder} 的模板：从原文中提取参数后填入译文
    """
    if not message:
        return message
    translations: dict = load_translations(locale)

    # 策略 1：全量精确匹配
    if message in translations:
        return translations[message]

    # 策略 2：error.<错误码> 形式（如 "Unauthorized" -> error.unauthorized）
    normalized_key = f"error.{message.lower().replace(' ', '_')}"
    if normalized_key in translations:
        return translations[normalized_key]

    # 策略 3：占位符模板匹配
    for template_key, translated in translations.items():
        if "{" not in template_key:
            continue
        template = (
            template_key.replace("error.", "", 1)
            if template_key.startswith("error.")
            else template_key
        )
        match = _compile_template(template).fullmatch(message)
        if match:
            try:
                return translated.format(**match.groupdict())
            except (IndexError, KeyError, ValueError):
                # 参数填入失败时返回不含参数的译文，仍优于英文原文
                return translated

    # 未命中，返回原文
    return message


def get_translated_error(error_data: dict) -> dict:
    """翻译错误响应中的 message / detail / error 字段（仅替换字符串值）

    覆盖 LiteLLM 既有错误形状：
    - {"detail": "..."}
    - {"message": "..."}
    - {"error": {"message": "..."}}
    - {"error": {"message": {"error": "..."}}}
    字段名与错误类型标识保持不变，保证客户端错误处理逻辑不受影响。
    """

    def _translate_node(node):  # type: (object) -> object
        if isinstance(node, dict):
            result = {}
            for key, value in node.items():
                if key in ("error", "message", "detail") and isinstance(value, str):
                    result[key] = translate_message(value)
                elif isinstance(value, (dict, list)):
                    result[key] = _translate_node(value)
                else:
                    result[key] = value
            return result
        if isinstance(node, list):
            return [_translate_node(item) for item in node]
        return node

    return _translate_node(error_data)  # type: ignore[return-value]
