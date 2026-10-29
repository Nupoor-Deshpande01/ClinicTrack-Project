# Serving `public-site/` with Apache Tomcat

The public website (Practicals 1 and 2) is plain HTML/CSS/JS, so it can be
hosted from **Apache Tomcat** — the Java EE servlet container taught in the
course. Two supported methods are shown below (Method A is enough for the
mini-project demo; Method B produces a proper `WAR` archive).

> Tip: opening `index.html` directly with a double-click (double-click → file://)
> also works for quick development, but the official demo flow uses Tomcat.

---

## 1. Install Apache Tomcat

### Windows

1. Open <https://tomcat.apache.org/download-10.cgi> and download the **64-bit
   Windows zip** (Tomcat 10.x or 11.x — the site is static HTML, so either works).
2. Unzip to a stable path, e.g. `C:\apache-tomcat-10` (this folder is called
   `TOMCAT_HOME` / `<CATALINA_HOME>` below).
3. Tomcat needs Java. If `java -version` prints nothing, install a JDK from
   <https://adoptium.net> and set the environment variable
   `JAVA_HOME=C:\path\to\jdk-21`.
4. Start it:

```bat
cd C:\apache-tomcat-10\bin
startup.bat      (or `catalina.bat run` to keep it in the same window)
```

5. Test: open `http://localhost:8080/` — the Tomcat welcome page should appear.

### Linux

```bash
sudo apt install -y openjdk-17-jdk                 # or any JDK ≥ 17
wget https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.35/bin/apache-tomcat-10.1.35.tar.gz
tar xzf apache-tomcat-10.1.35.tar.gz
export CATALINA_HOME=$PWD/apache-tomcat-10.1.35
$CATALINA_HOME/bin/startup.sh                      # stop with shutdown.sh
```

(Any JDK ≥ 11 works because the site has no servlet code.)

### Verify the port

Tomcat listens on **8080** by default (`conf/server.xml` → `<Connector port="8080">`).
If XAMPP or anything else already uses 8080, change it to **8081** there.

---

## 2. Method A — copy `public-site/` into `webapps/`

1. Copy the whole `public-site` folder into `TOMCAT_HOME/webapps/`:

```bash
# from the repo root
cp -r public-site /path/to/tomcat/webapps/clinictrack
```

2. Start Tomcat (or restart it; it hot-deploys new folders in `webapps/`).
3. Open **`http://localhost:8080/clinictrack/`** — the landing page loads.
4. The tools page is at `http://localhost:8080/clinictrack/tools.html`.

Default users can of course also open the folder inside `webapps` from any
device on the LAN at `http://<PC-IP>:8080/clinictrack/` — handy for the demo day.

---

## 3. Method B — package as a WARA WAR ("Web ARchive") is what Tomcat deploys when we want a single drop-in

file instead of a folder.

### 3.1 Create the tomcat-friendly WAR with the `jar` tool

```bash
# from the repo root (needs the JDK in PATH)
cd public-site
jar -cvf ../clinictrack.war .          # every file becomes a WAR entry
cd ..
cp clinictrack.war /path/to/tomcat/webapps/clinictrack.war
```

⚠️ **Important:** the archive must contain `index.html` at its **root** (not
inside a nested `public-site/` folder). That root is called the _docroot_ —
this is exactly what `cd public-site && jar -cvf ../clinictrack.war .` does.

### 3.2 Deploy and use (tomcat manager optional)

```bash
cp clinictrack.war /path/to/tomcat/webapps/
```

Tomcat auto-expands into `webapps/clinictrack/` within seconds. Verify:

```
http://localhost:8080/clinictrack/
http://localhost:8080/clinictrack/tools.html
```

### 3.3 (Optional) redeploy on file change

`webapps/clinictrack.war` is expanded once. While demos remain static you can
edit files directly inside `webapps/clinictrack/` — no re-packaging needed.

---

## 4. web.xml

The only descriptor the site needs is a **welcome-file list**: it tells
Tomcat which file to open for a request to `/clinictrack/`. The repo already
ships it — `public-site/WEB-INF/web.xml`:

```xml
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         version="6.0"
         xsi:schemaLocation="https://jakarta.ee/xml/ns/jakartaee
                             https://jakarta.ee/xml/ns/jakartaee/web-app_6_0.xsd">
  <description>Siddhivinayak Clinic static website (ClinicTrack mini project)</description>
  <welcome-file-list>
    <welcome-file>index.html</welcome-file>
  </welcome-file-list>
</web-app>
```

Even without `web.xml`, Tomcat's global `conf/web.xml` already defines
`index.html` as a welcome file — WEB-INF is kept so the viva question
"what does WEB-INF/web.xml do?" has a concrete answer.

---

## 5. Troubleshooting

| Problem                        | Fix                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404` on `/clinictrack/`       | Check the folder / WAR name in `webapps/` — deploy as `clinictrack.war` or as a copy of `public-site` renamed to `clinictrack`.                                                             |
| Page loads but no CSS/JS       | Paths are relative (`css/…`, `js/…`) — the site must be served from a _sub-folder_ context, e.g. `/clinictrack/…` from `webapps/clinictrack/`, not files copied singly into `webapps/ROOT`. |
| Tomcat starts then stops       | Port 8080 busy (`netstat -ano \| findstr 8080`) or `JAVA_HOME` not set.                                                                                                                     |
| `Forbidden` manager errors     | Only relevant if you use the Tomcat manager; follow its docs.                                                                                                                               |
| Bootstrap stays default colors | CDN blocked — download `bootstrap.min.css` / `bootstrap.bundle.min.js` / icons into `public-site/assets/vendor/` and update the four CDN `<link>`/`<script>` tags to local paths.           |

That's it — Method A takes under five minutes and is what we use in the lab.
