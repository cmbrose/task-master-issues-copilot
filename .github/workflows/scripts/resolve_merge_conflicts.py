import subprocess
from pathlib import Path

def read_current_file(path: str) -> str:
    """ Gets the entire contents of the given file on the current branch """
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading file {path}: {e}")
        return ""
    
def read_head_file(path: str) -> str:
    """ Gets the entire contents of the given file on HEAD """
    try:
        result = subprocess.run([
            'git', 'show', f'HEAD:{path}'
        ], capture_output=True, text=True, check=True)
        return result.stdout
    except Exception as e:
        print(f"Error reading file {path} from HEAD: {e}")
        return ""

def delete_file(path: str) -> bool:
    """ Deletes the file at the given path. Only files are supported. """

    try:
        file_path = Path(path)
        if file_path.is_file():
            file_path.unlink()
            return True
        else:
            print(f"Path {path} is not a file or does not exist.")
            return False
    except Exception as e:
        print(f"Error deleting file {path}: {e}")
        return False

def replace_in_file(path: str, original: str, replacement) -> bool:
    """ 
    Performs a string replace operation in the given file. Conflict markers are NOT automatically included.
    Returns True if a replacement occured and False if the orginal text was not found.
    """

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        if original not in content:
            return False
        new_content = content.replace(original, replacement)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    except Exception as e:
        print(f"Error replacing text in {path}: {e}")
        return False

    