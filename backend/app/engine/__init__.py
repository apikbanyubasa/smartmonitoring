"""
Engine Package untuk Deteksi Real-time, Computer Vision, dan Lifecycle Worker Threads.
"""
from .analyzer import (
    generate_frames,
    LATEST_DETECTION_STATS,
    LOCATION_TRACKERS,
    reset_location_data,
    GLOBAL_TRACKED_OBJECTS,
    GLOBAL_NOTIFICATION_ENABLED,
    run_detection_worker,
    set_global_app_instance,
    get_flask_app_context,
)
from .context import (
    get_notification_enabled,
    set_notification_enabled,
    toggle_notification_enabled,
)
from .workers_manager import (
    initialize_workers_and_server,
    reload_workers_thread,
    stop_all_detection_threads,
)

__all__ = [
    "generate_frames",
    "LATEST_DETECTION_STATS",
    "LOCATION_TRACKERS",
    "reset_location_data",
    "GLOBAL_TRACKED_OBJECTS",
    "GLOBAL_NOTIFICATION_ENABLED",
    "get_notification_enabled",
    "set_notification_enabled",
    "toggle_notification_enabled",
    "run_detection_worker",
    "set_global_app_instance",
    "get_flask_app_context",
    "initialize_workers_and_server",
    "reload_workers_thread",
    "stop_all_detection_threads",
]
