import time

def timer(func):
    """
    関数の実行時間を計測するデコレーター
    """
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        elapsed_time = end_time - start_time
        print(f"{func.__name__} の実行時間: {elapsed_time:.6f}秒")
        return result
    return wrapper


if __name__ == "__main__":
    @timer
    def test():
        time.sleep(1)
    
    test()
    