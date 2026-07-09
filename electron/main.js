// Electron 메인 프로세스 — Express 백엔드를 같은 프로세스 안에서 직접 구동하고,
// React 빌드 결과(dist/index.html)를 BrowserWindow로 띄운다.
import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_PATH = path.join(__dirname, "..", "build", "icon.png");

// package.json의 "name"(greenflow-content-automation) 대신 사용자 데이터 폴더 이름을
// productName과 맞춰 예측 가능하게 만든다(app.getPath('userData')가 이 이름을 사용한다).
app.setName("Greenflow");

// 스케줄러가 SNS에 중복 발행하는 사고를 막기 위해 앱은 단일 인스턴스로만 실행한다.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let tray = null;
  let isQuitting = false;

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 빈 포트를 동적으로 찾는다 — 다른 프로그램과 포트 충돌을 피하기 위함.
  function findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.on("error", reject);
      srv.listen(0, "127.0.0.1", () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
      });
    });
  }

  async function createWindow() {
    const port = await findFreePort();

    // server/index.js는 GREENFLOW_ELECTRON=1일 때 자동 기동을 건너뛰고 startServer()를
    // 직접 호출하도록 되어 있다. GREENFLOW_DATA_DIR은 설치 폴더가 아닌 사용자 데이터 폴더에
    // 설정·API 키·생성된 이미지를 저장하기 위해 필요하다(설치 폴더는 쓰기 권한이 없을 수 있음).
    process.env.GREENFLOW_ELECTRON = "1";
    process.env.GREENFLOW_DATA_DIR = app.getPath("userData");

    const { startServer } = await import("../server/index.js");
    await startServer(port);

    const apiBase = `http://127.0.0.1:${port}`;

    mainWindow = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      icon: ICON_PATH,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        additionalArguments: [`--api-base=${apiBase}`],
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

    // 창을 닫아도 앱을 종료하지 않고 트레이로 최소화한다 — 예약 발행 스케줄러가
    // 계속 동작해야 하기 때문이다. 완전 종료는 트레이 메뉴의 "완전 종료"로만 가능하다.
    mainWindow.on("close", (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }

  function createTray() {
    const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip("Greenflow 콘텐츠 자동화");

    const menu = Menu.buildFromTemplate([
      {
        label: "열기",
        click: () => {
          if (!mainWindow) return;
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: "separator" },
      {
        label: "완전 종료",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);

    tray.on("click", () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide();
      else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    await createWindow();
    createTray();
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  // 창이 전부 닫혀도(트레이로 숨긴 상태 포함) 스케줄러 유지를 위해 앱 프로세스는 종료하지 않는다.
  app.on("window-all-closed", () => {});
}
