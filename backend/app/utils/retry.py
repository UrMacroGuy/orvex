from __future__ import annotations

import asyncio
import random
from typing import Awaitable, Callable, Iterable, TypeVar

T = TypeVar("T")


async def with_retries(
    func: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 4.0,
    retry_on: Iterable[type[BaseException]] = (Exception,),
) -> T:
    last: BaseException | None = None
    retry_types = tuple(retry_on)
    for i in range(attempts):
        try:
            return await func()
        except retry_types as e:
            last = e
            if i == attempts - 1:
                break
            delay = min(max_delay, base_delay * (2 ** i))
            delay *= 0.7 + 0.6 * random.random()
            await asyncio.sleep(delay)
    assert last is not None
    raise last
