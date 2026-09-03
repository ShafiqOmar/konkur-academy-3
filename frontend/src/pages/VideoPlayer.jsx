import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const BUNNY_PLAYER_SCRIPT = '//assets.mediadelivery.net/playerjs/playerjs-latest.min.js';

function isBunnyEmbedUrl(url) {
  return typeof url === 'string' && url.includes('iframe.mediadelivery.net/embed/');
}

// پخش‌کننده‌ی محلی: تگ <video> معمولی، مثل قبل
function LocalVideo({ video, videoRef, onTimeUpdate, onEnded }) {
  return (
    <video
      ref={videoRef}
      src={video.url}
      controls
      className="w-full aspect-video"
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
      defaultMuted={false}
      {...(video.progress?.watched_seconds
        ? { onLoadedMetadata: (e) => (e.target.currentTime = video.progress.watched_seconds) }
        : {})}
    />
  );
}

// پخش‌کننده‌ی Bunny Stream: iframe + player.js برای ردیابی پیشرفت
// مستندات: https://docs.bunny.net/docs/playback-control-api
function BunnyVideo({ video, onProgress, onEnded }) {
  const iframeRef = useRef(null);
  const seekedRef = useRef(false);

  useEffect(() => {
    let player;
    let cancelled = false;

    function attachPlayer() {
      if (cancelled || !window.playerjs || !iframeRef.current) return;

      player = new window.playerjs.Player(iframeRef.current);

      player.on('ready', () => {
        if (video.progress?.watched_seconds && !seekedRef.current) {
          seekedRef.current = true;
          player.setCurrentTime(video.progress.watched_seconds);
        }

        player.on('timeupdate', (data) => {
          if (Math.floor(data.seconds) % 10 === 0) {
            onProgress(Math.floor(data.seconds), data.duration);
          }
        });

        player.on('ended', () => onEnded());
      });
    }

    if (window.playerjs) {
      attachPlayer();
    } else {
      const existing = document.querySelector(`script[src="${BUNNY_PLAYER_SCRIPT}"]`);
      if (existing) {
        existing.addEventListener('load', attachPlayer);
      } else {
        const script = document.createElement('script');
        script.src = BUNNY_PLAYER_SCRIPT;
        script.async = true;
        script.onload = attachPlayer;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.url]);

  return (
    <iframe
      ref={iframeRef}
      src={video.url}
      loading="lazy"
      className="w-full aspect-video border-0"
      allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
      allowFullScreen
      title={video.title}
    />
  );
}

export default function VideoPlayer() {
  const { id } = useParams();
  const { token } = useAuth();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    api.getVideo(id, token).then(setVideo).catch((e) => setError(e.message));
  }, [id, token]);

  // ذخیره‌ی پیشرفت هر ۱۰ ثانیه (تگ <video> محلی)
  function handleTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    if (Math.floor(el.currentTime) % 10 === 0) {
      const completed = el.currentTime >= el.duration - 2;
      api.saveProgress(id, { watched_seconds: Math.floor(el.currentTime), completed }, token).catch(() => {});
    }
  }

  function handleEnded() {
    const el = videoRef.current;
    api.saveProgress(id, { watched_seconds: Math.floor(el?.duration || 0), completed: true }, token).catch(() => {});
  }

  // ذخیره‌ی پیشرفت هر ۱۰ ثانیه (Bunny Stream player.js)
  function handleBunnyProgress(seconds, duration) {
    const completed = duration ? seconds >= duration - 2 : false;
    api.saveProgress(id, { watched_seconds: seconds, completed }, token).catch(() => {});
  }

  function handleBunnyEnded() {
    api.saveProgress(id, { watched_seconds: video?.duration_seconds || 0, completed: true }, token).catch(() => {});
  }

  if (error) return <p className="text-center text-red-600 py-16">{error}</p>;
  if (!video) return <p className="text-center text-ink/50 py-16">در حال بارگذاری...</p>;

  const isBunny = isBunnyEmbedUrl(video.url);

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-black text-heading mb-4">{video.title}</h1>
      <div className="rounded-xl overflow-hidden bg-black">
        {isBunny ? (
          <BunnyVideo video={video} onProgress={handleBunnyProgress} onEnded={handleBunnyEnded} />
        ) : (
          <LocalVideo video={video} videoRef={videoRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} />
        )}
      </div>
      {video.progress?.completed ? (
        <p className="mt-3 text-sage font-bold text-sm">✓ این ویدیو را تماشا کرده‌اید</p>
      ) : (
        <p className="mt-3 text-ink/50 text-sm">پیشرفت شما به‌طور خودکار ذخیره می‌شود.</p>
      )}
    </div>
  );
}
