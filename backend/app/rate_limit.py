# A single shared Limiter instance. It has to be one object, imported by
# both main.py (to register the middleware/exception handler) and any
# router that wants to decorate an endpoint with @limiter.limit(...) —
# multiple Limiter instances would track separate counters and defeat the
# rate limiting.
from slowapi import Limiter
from slowapi.util import get_remote_address

# Keys each caller by their source IP address.
limiter = Limiter(key_func=get_remote_address)
