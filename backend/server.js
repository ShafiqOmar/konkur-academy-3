const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ سرور آموزشگاه کانکور روی پورت ${PORT} فعال است`);
});
