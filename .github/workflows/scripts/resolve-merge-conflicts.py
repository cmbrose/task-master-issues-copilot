import subprocess
from pathlib import Path
import re
import os

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

def apply_git_patch(path: str, patch: str) -> bool:
    """ Applies the given git patch to the file at the given path """
    # Handle pseudo-patch format
    if patch.strip().startswith('*** Begin Patch'):
        print('Pseudo-patch detected, applying manually.')
        # Handle *** Delete File: <file>
        delete_file_match = re.search(r'\*\*\* Delete File: (.+)', patch)
        if delete_file_match:
            try:
                os.remove(path)
                print(f"Deleted file {path} via pseudo-patch.")
                return True
            except Exception as e:
                print(f"Error deleting file {path}: {e}")
                return False
            
        update_file_match = re.search(r'\*\*\* Update File: (.+)', patch)
        if not update_file_match:
            print('Unsupported pseudo-patch type.')
            return False
        # Extract the diff block
        diff_block = re.search(r'@@[\s\S]*?\*\*\* End Patch', patch)
        if not diff_block:
            print('No diff block found in pseudo-patch.')
            return False
        diff_lines = diff_block.group(0).splitlines()
        # Read the file
        try:
            with open(path, 'r', encoding='utf-8') as f:
                file_lines = f.readlines()
        except Exception as e:
            print(f"Error reading file {path}: {e}")
            return False
        # Find the first line in diff_lines that matches a context line in file_lines
        # and replace the block between -<<<<<<< and ->>>>>>> with the + lines
        new_file_lines = []
        i = 0
        while i < len(file_lines):
            line = file_lines[i]
            if any(l.startswith('-<<<<<<<') for l in diff_lines):
                # Find the start of the conflict in file_lines
                if line.lstrip().startswith('<<<<<<<'):
                    # Skip to >>>>>>>
                    while i < len(file_lines) and not file_lines[i].lstrip().startswith('>>>>>>>'):
                        i += 1
                    i += 1  # skip >>>>>>>
                    # Insert the + lines from the patch
                    for l in diff_lines:
                        if l.startswith('+'):
                            new_file_lines.append(l[1:] + '\n')
                    continue
            new_file_lines.append(line)
            i += 1
        # Write the new file
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(new_file_lines)
            print(f"Applied pseudo-patch to {path}")
            return True
        except Exception as e:
            print(f"Error writing file {path}: {e}")
            return False
    # Otherwise, try to apply as a real patch
    try:
        patch_file = Path(path).with_suffix('.patch')
        patch_file.write_text(patch, encoding='utf-8')
        result = subprocess.run([
            'git', 'apply', str(patch_file)
        ], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"git apply failed: {result.stderr}")
            patch_file.unlink(missing_ok=True)
            return False
        patch_file.unlink(missing_ok=True)
        return True
    except Exception as e:
        print(f"Error applying patch to {path}: {e}")
        return False