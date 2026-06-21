import ctypes
from datetime import datetime
import json
import os
import re
import shutil
import signal
import sys
import time
import webview
import subprocess
import atexit
import threading
import psutil
import win32gui


# https://stackoverflow.com/a/65501621
from win32event import CreateMutex
from win32api import CloseHandle, GetLastError
from winerror import ERROR_ALREADY_EXISTS
class SingleInstance:
	""" Limits application to single instance """

	def __init__(self):
		self.mutexname = "dcef-qwertyuiopasdfghjklzxcvbnm1234567890"
		self.mutex = CreateMutex(None, False, self.mutexname)
		self.lasterror = GetLastError()

	def is_secondary_instance(self):
		return self.lasterror == ERROR_ALREADY_EXISTS

	def is_primary_instance(self):
		return not self.lasterror == ERROR_ALREADY_EXISTS

	def __del__(self):
		if self.mutex:
			CloseHandle(self.mutex)




def is_compiled():
	if os.path.exists(__file__):
		return False
	else:
		return True

def kill_dcef_processes():
	dcef_process_names = ['dceffastapi.exe', 'dcefnginx.exe', 'dcefmongod.exe', 'dcefpreprocess.exe']
	# subprocess.run と CREATE_NO_WINDOW を使用して、ウィンドウを表示せずに taskkill を実行します。
	creationflags = 0
	if sys.platform == 'win32':
		creationflags = 0x08000000  # subprocess.CREATE_NO_WINDOW
	
	cmd = ['taskkill', '/f']
	for name in dcef_process_names:
		cmd.extend(['/im', name])
	
	try:
		subprocess.run(cmd, creationflags=creationflags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
	except Exception:
		pass

def kill_windows_runner():
	# subprocess.run と CREATE_NO_WINDOW を使用して、ウィンドウを表示せずに taskkill を実行します。
	creationflags = 0
	if sys.platform == 'win32':
		creationflags = 0x08000000  # subprocess.CREATE_NO_WINDOW
	
	cmd = ['taskkill', '/f', '/im', 'dcef.exe']
	try:
		subprocess.run(cmd, creationflags=creationflags, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
	except Exception:
		pass


def custom_print(source, *args, **kwargs):

	str_args = [str(arg) for arg in args]

	datetime_obj = datetime.now()

	log_message = str(datetime_obj) + "  " + source.ljust(16) + ' '.join(str_args)
	if 'end' in kwargs and kwargs['end'] == '':
		log_message = log_message[:-1]

	blacklist = ["Slow SessionWorkflow loop", "Slow query"]  # this just spams the logs and is not useful
	if any([blacklisted in log_message for blacklisted in blacklist]):
		return

	print(log_message)

	# log to file
	with open(LOG_FILE, 'a') as f:
		f.write(log_message + '\n')


def check_used_ports():
	connections = psutil.net_connections()
	used_ports = set()

	for connection in connections:
		if connection.status == 'LISTEN':
			used_ports.add(connection.laddr.port)

	used_ports_list = list(used_ports)
	used_ports_list.sort()

	custom_print("windows-runner:", 'used ports:', " ".join([str(port) for port in used_ports_list]))

	required_port_is_used = False

	if 21011 in used_ports:
		custom_print("windows-runner:", 'WARNING: Needed port 21011 is already in use. This port is required by nginx')
		required_port_is_used = True

	if 27017 in used_ports:
		custom_print("windows-runner:", 'WARNING: Needed port 27017 is already in use. This port is required by mongodb.')
		required_port_is_used = True

	if 58000 in used_ports:
		custom_print("windows-runner:", 'WARNING: Needed port 58000 is already in use. This port is required by fastapi')
		required_port_is_used = True

	if required_port_is_used:
		custom_print("windows-runner:", '##########################################################################################')
		custom_print("windows-runner:", '# WARNING: THE PROGRAM MAY NOT WORK PROPERLY, BECAUSE REQUIRED PORTS ARE ALREADY IN USE! #')
		custom_print("windows-runner:", '##########################################################################################')
		time.sleep(5)
	else:
		custom_print("windows-runner:", 'OK: All required ports are available.')


def cleanup():
	global terminating_now
	if not terminating_now:  # Prevents cleanup from being called twice
		terminating_now = True

		kill_dcef_processes()

		# delete nginx temp folder
		temp_folder = BASE_DIR + '/temp'
		if os.path.exists(temp_folder):
			shutil.rmtree(temp_folder)

		kill_windows_runner()



def load_window_state():
	"""保存済みのウィンドウ状態をJSONファイルから読み込む"""
	default_state = {'width': 1280, 'height': 720, 'x': None, 'y': None, 'maximized': False}
	try:
		state_file = BASE_DIR + '/dcef/storage/window_state.json'
		if os.path.exists(state_file):
			with open(state_file, 'r') as f:
				state = json.load(f)
				# サイズの最低値チェック
				if state.get('width', 0) < 200 or state.get('height', 0) < 100:
					return default_state
				custom_print("windows-runner:", "ウィンドウ状態を復元", str(state))
				return state
	except Exception as e:
		custom_print("windows-runner:", "ウィンドウ状態の読み込みに失敗", str(e))
	return default_state

def save_window_state(title):
	"""ウィンドウの位置・サイズ・最大化状態をJSONファイルに保存する"""
	try:
		hwnd = win32gui.FindWindow(None, title)
		if not hwnd:
			custom_print("windows-runner:", "ウィンドウハンドルが見つかりません")
			return

		# GetWindowPlacement は最大化中でも通常時の位置・サイズを返す
		placement = win32gui.GetWindowPlacement(hwnd)
		show_cmd = placement[1]
		normal_pos = placement[4]  # (left, top, right, bottom)

		state = {
			'x': normal_pos[0],
			'y': normal_pos[1],
			'width': normal_pos[2] - normal_pos[0],
			'height': normal_pos[3] - normal_pos[1],
			'maximized': show_cmd == 3  # SW_SHOWMAXIMIZED = 3
		}

		state_file = BASE_DIR + '/dcef/storage/window_state.json'
		os.makedirs(os.path.dirname(state_file), exist_ok=True)
		with open(state_file, 'w') as f:
			json.dump(state, f)
		custom_print("windows-runner:", "ウィンドウ状態を保存", str(state))
	except Exception as e:
		custom_print("windows-runner:", "ウィンドウ状態の保存に失敗", str(e))


def create_window():
	custom_print("windows-runner:", "creating window")
	title = 'DiscordChatExporter-frontend'
	if myapp.is_secondary_instance():
		title += ' (secondary instance)'

	# 前回のウィンドウ状態を読み込み
	ws = load_window_state()

	window = webview.create_window(title, 'http://127.0.0.1:21011/',
		width=ws['width'],
		height=ws['height'],
		x=ws.get('x'),
		y=ws.get('y'),
		background_color='#36393F',
		text_select=True,
		zoomable=True,
		draggable=True,
	)

	# 前回最大化されていた場合、ウィンドウ読み込み後に最大化 (loadedの方が確実)
	if ws.get('maximized'):
		def on_loaded():
			custom_print("windows-runner:", "restoring maximized state")
			try:
				window.maximize()
			except:
				pass
			# 念のためWin32APIでも実行
			try:
				hwnd = win32gui.FindWindow(None, title)
				if hwnd:
					win32gui.ShowWindow(hwnd, 3) # SW_SHOWMAXIMIZED = 3
			except:
				pass
		window.events.loaded += on_loaded

	# ウィンドウを閉じる前に状態を保存
	def on_closing():
		save_window_state(title)
	window.events.closing += on_closing

	webview.start(debug=False, storage_path=BASE_DIR + '/dcef/storage', private_mode=False)
	custom_print("windows-runner:", "window closed")

def create_dir_if_not_exists(path):
	if not os.path.exists(path):
		os.makedirs(path)

def runner(name, args, cwd):
	custom_print("windows-runner:", name + " started")
	
	# 実行ファイルのパスが相対パスの場合、cwd を用いて絶対パスに解決します。
	exec_path = args[0]
	if not os.path.isabs(exec_path):
		exec_path = os.path.abspath(os.path.join(cwd, exec_path))
	
	args = [exec_path] + args[1:]
	
	creationflags = 0
	if sys.platform == 'win32':
		creationflags = 0x08000000  # subprocess.CREATE_NO_WINDOW
		
	process = subprocess.Popen(args, stdout=subprocess.PIPE, bufsize=1, cwd=cwd, stderr=subprocess.STDOUT, encoding='utf-8', creationflags=creationflags)
	processes.append(process)

	for byte_line in iter(process.stdout.readline, ''):
		try:
			custom_print(name + ':', byte_line, end='') # process line here
		except Exception as e:
			# it looks like the message is printed even if the exception is raised. So we can ignore it
			pass

	custom_print("windows-runner:", name + ' finished')

def start_preprocess():
	cwd = os.path.realpath(BASE_DIR + '/dcef/backend/preprocess')
	args = ['dcefpreprocess.exe', 'windows']
	th = threading.Thread(target=runner, args=('preprocess', args, cwd), daemon=False)
	th.start()
	return th

def start_mongodb():
	create_dir_if_not_exists(BASE_DIR + '/_temp/mongodb')

	cwd = os.path.realpath(BASE_DIR + '/dcef/backend/mongodb')
	args = ['dcefmongod.exe', '--dbpath', "../../../_temp/mongodb"]
	th = threading.Thread(target=runner, args=('mongodb', args, cwd), daemon=False)
	th.start()
	return th

def start_fastapi():
	cwd = os.path.realpath(BASE_DIR + '/dcef/backend/fastapi')
	args = ['dceffastapi.exe']
	th = threading.Thread(target=runner, args=('fastapi', args, cwd), daemon=False)
	th.start()
	return th

def start_nginx():
	create_dir_if_not_exists(BASE_DIR + '/logs')
	create_dir_if_not_exists(BASE_DIR + '/temp')
	cwd = os.path.realpath(BASE_DIR)
	args = ['dcef\\backend\\nginx\\dcefnginx.exe', '-c', 'dcef/backend/nginx/conf/nginx-prod.conf']
	th = threading.Thread(target=runner, args=('nginx', args, cwd), daemon=False)
	th.start()
	return th

def hide_console():
	# https://github.com/pyinstaller/pyinstaller/issues/1339#issuecomment-122909830
	if is_compiled():
		whnd = ctypes.windll.kernel32.GetConsoleWindow()
		if whnd != 0:
			ctypes.windll.user32.ShowWindow(whnd, 0)

def show_console():
	if is_compiled():
		whnd = ctypes.windll.kernel32.GetConsoleWindow()
		if whnd != 0:
			ctypes.windll.user32.ShowWindow(whnd, 1)




def get_exports_state(exports_dir):
	state = {}
	if not os.path.exists(exports_dir):
		return state

	for root, dirs, files in os.walk(exports_dir):
		for file in files:
			if file.endswith('.json'):
				if file.endswith('channel_info.json') or file.endswith('guild_info.json'):
					continue
				if re.search(r"-([a-fA-F0-9]{5})\.json$", file) is not None:
					continue
				
				full_path = os.path.join(root, file)
				rel_path = os.path.relpath(full_path, exports_dir).replace('\\', '/')
				try:
					stat = os.stat(full_path)
					state[rel_path] = {
						"size": stat.st_size,
						"mtime": stat.st_mtime
					}
				except Exception:
					pass
	return state


def main():
	if myapp.is_secondary_instance():
		# second instance just needs to open another window, the backend services are already running
		custom_print("windows-runner:", "started secondary instance")
		hide_console()
		create_window()
		show_console()
		custom_print("windows-runner:", "finished secondary instance")

	else:
		kill_dcef_processes()  # kill any running instances of dcef processes before starting new ones
		if os.path.exists(LOG_FILE):
			os.remove(LOG_FILE)

		custom_print("windows-runner:", "started primary instance")
		check_used_ports()
		atexit.register(cleanup)
		th_nginx = start_nginx()
		time.sleep(1)
		th_mongodb = start_mongodb()
		th_fastapi = start_fastapi()
		
		# Check if we can skip preprocessing
		should_skip_preprocess = False
		schema_version = None
		schema_version_path = os.path.join(BASE_DIR, 'dcef/backend/preprocess/schema_version.json')
		if os.path.exists(schema_version_path):
			try:
				with open(schema_version_path, 'r', encoding='utf-8') as f:
					schema_version = json.load(f).get('schema_version')
			except Exception as e:
				custom_print("windows-runner:", f"Error reading schema_version.json: {e}")

		cache_path = os.path.join(BASE_DIR, 'dcef/storage/preprocess_cache.json')
		db_dir = os.path.join(BASE_DIR, '_temp/mongodb')
		db_exists = os.path.exists(db_dir) and len(os.listdir(db_dir)) > 0

		if db_exists and schema_version is not None and os.path.exists(cache_path):
			try:
				with open(cache_path, 'r', encoding='utf-8') as f:
					cache_data = json.load(f)
				
				cached_version = cache_data.get('schema_version')
				cached_files = cache_data.get('files', {})
				
				if cached_version == schema_version:
					exports_dir = os.path.join(BASE_DIR, 'exports')
					current_files = get_exports_state(exports_dir)
					
					if current_files == cached_files:
						should_skip_preprocess = True
						custom_print("windows-runner:", "Preprocess skipped (no changes detected in exports directory and schema version matches)")
					else:
						custom_print("windows-runner:", "Preprocess required (changes detected in exports directory)")
				else:
					custom_print("windows-runner:", f"Preprocess required (schema version mismatch: cached {cached_version} vs current {schema_version})")
			except Exception as e:
				custom_print("windows-runner:", f"Error loading preprocess cache, running preprocess: {e}")
		else:
			if not db_exists:
				custom_print("windows-runner:", "Preprocess required (database does not exist or is empty)")
			else:
				custom_print("windows-runner:", "Preprocess required (cache file not found)")

		if should_skip_preprocess:
			th_preprocess = None
		else:
			th_preprocess = start_preprocess()


		if th_preprocess is not None:
			th_preprocess.join()  # Wait for preprocess to finish

		hide_console()
		create_window()
		show_console()

		custom_print("windows-runner:", "finished primary instance")
		cleanup()



myapp = SingleInstance()
processes = []
terminating_now = False

if is_compiled():
	BASE_DIR = os.path.realpath(os.path.dirname(sys.executable))
else:
	BASE_DIR = os.path.realpath(os.path.dirname(__file__) + '/../../release')
	print("DON'T RUN THIS SCRIPT DIRECTLY. RUN compiled dcef.exe in release folder instead.")
	sys.exit(1)

LOG_FILE = BASE_DIR + '/logs/dcef.log'
create_dir_if_not_exists(BASE_DIR + '/logs')

if __name__ == '__main__':
	main()