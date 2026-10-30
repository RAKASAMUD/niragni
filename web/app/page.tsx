import Reveal from '@/components/Reveal';
import { APK_URL, DEMO_VIDEO_URL, REPO_URL } from '@/lib/config';

const features = [
  ['peach', 'On-device AI', 'A vision-language model reads your photos and notes and writes the draft. No server, no API key.'],
  ['lav', 'Draft, never auto-send', 'You review and edit every field. Nothing is submitted until you pick a channel and send it yourself.'],
  ['blue', 'Local-first storage', 'Reports, photos and model state live in SQLite on the phone. Private data stays private.'],
] as const;

const steps = [
  ['Download the APK', 'Get niragni-android.apk from the GitHub Release.'],
  ['Allow install', 'Enable installs from this source on your Android 12+ phone (arm64).'],
  ['Import the model', 'Open Readiness and import the SmolVLM2 GGUF + projector once (~545 MB).'],
  ['Go offline', 'Turn on airplane mode, write a note, add a photo, tap Generate draft.'],
] as const;

const rows = [
  ['SDK', '@qvac/sdk 0.22.0'],
  ['Android runtime', '@qvac/fabric-android-arm64 0.22.0'],
  ['Model', 'SmolVLM2-500M-Video-Instruct · Q8_0 GGUF + mmproj'],
  ['Model licence', 'Apache-2.0'],
  ['Model SHA-256', '6f67b803…66438bc'],
  ['Projector SHA-256', '921dc7e2…0ef520b'],
  ['App', 'Expo SDK 54 · React Native 0.81 · SQLite'],
] as const;

export default function Page() {
  return (
    <main className="wrap">
      <nav>
        <div className="brand"><img className="mark" src="/logo.png" alt="Niragni" />NIRAGNI</div>
        <div className="links"><a href="#demo">Demo</a><a href="#install">Install</a><a href="#hood">Under the hood</a><a href="#status">Status</a></div>
        <a className="btn sm" href={APK_URL}>Download APK</a>
      </nav>

      <div className="hero">
        <div className="copy">
          <span className="pill">AI Yako · Offline AI Apps</span>
          <h1>Seeing smoke?<br />Report it offline.</h1>
          <p className="lead">Niragni drafts a wildfire (karhutla) observation report on your phone. A vision-language model runs on-device through QVAC, so it works with no internet and no data leaving the device.</p>
          <div className="actions"><a className="btn" href={APK_URL}>Download APK</a><a className="btn light" href={REPO_URL}>View on GitHub</a></div>
          <small>Android 12+ · arm64 · ~86 MB · SmolVLM2-500M imported once</small>
        </div>
        <div className="stage" aria-hidden="true">
          <div className="phone">
            <span className="blob b1" /><span className="blob b2" />
            <div className="p-top"><span>9:41</span><span>●  ▰</span></div>
            <div className="p-brand"><img className="mark" src="/logo.png" alt="" /><div><b>NIRAGNI</b><span>Kamis, 29 Oktober</span></div></div>
            <div className="p-card blue"><h4>Melihat<br />Asap?</h4><p>Catat pengamatan Anda.<br />Foto bisa ditambahkan nanti.</p><span className="p-btn">Buat laporan</span>
              <div className="paper"><i style={{ top: 30, width: 34 }} /><i style={{ top: 42, width: 24 }} /></div></div>
            <div className="p-h">Draf Anda <span>1 draf</span></div>
            <div className="p-card peach"><em>Draf lokal</em><h5>Asap dari arah kebun</h5><p>Lokasi belum diisi</p></div>
            <div className="p-nav"><span className="on">Laporan</span><span>Bantuan</span><span>Kesiapan</span></div>
          </div>
        </div>
      </div>

      <section id="demo">
        <Reveal><h2>See it work with the internet off</h2></Reveal>
        <Reveal index={1}>
          <div className="video">
            {DEMO_VIDEO_URL ? (
              <iframe src={DEMO_VIDEO_URL} title="Niragni offline demo" allowFullScreen loading="lazy" />
            ) : (
              <div><span className="play" />Demo video · airplane mode on, AI draft generated on-device</div>
            )}
          </div>
        </Reveal>
      </section>

      <section>
        <div className="grid g3">
          {features.map(([c, t, d], i) => (
            <Reveal key={t} index={i}><div className={`card ${c}`}><span className="pill">0{i + 1}</span><h3>{t}</h3><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="install">
        <Reveal><h2>Install in four steps</h2></Reveal>
        <div className="grid g4">
          {steps.map(([t, d], i) => (
            <Reveal key={t} index={i}><div className="card sm white"><span className="num">0{i + 1}</span><b>{t}</b><p>{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section id="hood">
        <div className="hood">
          <Reveal><div><h2>Under the hood</h2><p className="lead muted">Built on QVAC for local inference. Packages and model files are pinned so judges can reproduce the setup.</p></div></Reveal>
          <Reveal index={1}>
            <div className="tbl">
              {rows.map(([k, v]) => (<div className="row" key={k}><span>{k}</span><span className={k.includes('SHA') ? 'hash' : ''}>{v}</span></div>))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="status">
        <div className="grid g2">
          <Reveal><div className="card lav"><h3>Works offline</h3><p>Writing a report · adding photos · AI draft generation · local drafts · preview and export.</p></div></Reveal>
          <Reveal index={1}><div className="card peach"><h3>Needs a network</h3><p>First model download (skipped if you import the file) · sending a report through an external channel.</p></div></Reveal>
        </div>
      </section>

      <footer><div className="brand"><img className="mark" src="/logo.png" alt="Niragni" />NIRAGNI</div><span>Built for AI Yako · Offline AI Apps · <a href={REPO_URL}>github.com/RAKASAMUD/niragni</a></span></footer>
    </main>
  );
}
