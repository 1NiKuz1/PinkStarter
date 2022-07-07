import pkg from "gulp";
const { gulp, src, dest, parallel, series, watch } = pkg;

import browsersync from "browser-sync";
import bssi from "browsersync-ssi";
import del from "del";
import dartSass from "sass";
import gulpSass from "gulp-sass";
import postCss from "gulp-postcss";
import cssnano from "cssnano";
import autoprefixer from "autoprefixer";
import concat from "gulp-concat";
import sassglob from "gulp-sass-glob";
import webpackStream from "webpack-stream";
import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";
import imagemin from "gulp-imagemin";
import changed from "gulp-changed";
import rsync from "gulp-rsync";

const sass = gulpSass(dartSass);
const fileswatch = "html,htm,txt,json,md,woff2";

function browserSync() {
  browsersync.init({
    server: {
      baseDir: "src/",
      middleware: bssi({ baseDir: "src/", ext: ".html" }),
    },
    ghostMode: { clicks: false },
    notify: false,
    online: true,
  });
}

function buildcopy() {
  return src(
    [
      "{src/js,src/css}/*.min.*",
      "src/images/**/*.*",
      "!src/images/src/**/*",
      "src/fonts/**/*",
      "src/*.html",
    ],
    { base: "src/" }
  ).pipe(dest("dist"));
}

async function cleandist() {
  del("dist/**/*", { force: true });
}

function deploy() {
  return src("dist/").pipe(
    rsync({
      root: "dist/",
      hostname: "username@yousite.com",
      destination: "yousite/public_html/",
      // clean: true, // Mirror copy with file deletion
      include: [
        /* '*.htaccess' */
      ], // Included files to deploy,
      exclude: ["**/Thumbs.db", "**/*.DS_Store"],
      recursive: true,
      archive: true,
      silent: false,
      compress: true,
    })
  );
}

function styles() {
  return src(["src/styles/*.scss", "!src/styles/_*.scss"])
    .pipe(sassglob())
    .pipe(sass({ "include css": true }).on("error", sass.logError))
    .pipe(concat("style.min.css"))
    .pipe(
      postCss([
        autoprefixer({ grid: "autoplace" }),
        cssnano({
          preset: ["default", { discardComments: { removeAll: true } }],
        }),
      ])
    )
    .pipe(dest("src/css/"))
    .pipe(browsersync.stream());
}

function scripts() {
  return src(["src/js/*.js", "!src/js/*.min.js"])
    .pipe(
      webpackStream(
        {
          mode: "development",
          performance: { hints: false },
          plugins: [
            new webpack.ProvidePlugin({
              //...
            }),
          ],
          optimization: {
            minimize: true,
            minimizer: [
              new TerserPlugin({
                terserOptions: { format: { comments: false } },
                extractComments: false,
              }),
            ],
          },
        },
        webpack
      )
    )
    .pipe(concat("app.min.js"))
    .pipe(dest("src/js/"))
    .pipe(browsersync.stream());
}

function images() {
  return src(["src/images/src/**/*"])
    .pipe(changed("src/images/dist"))
    .pipe(imagemin())
    .pipe(dest("src/images/dist"))
    .pipe(browsersync.stream());
}

function watcher() {
  watch("src/styles/**/*.scss", { usePolling: true }, styles);
  watch(
    ["src/js/**/*.js", "!src/js/**/*.min.js"],
    { usePolling: true },
    scripts
  );
  watch("src/images/src/**/*", { usePolling: true }, images);
  watch(`src/**/*.{${fileswatch}}`, { usePolling: true }).on(
    "change",
    browsersync.reload
  );
}

const dev = series(styles, scripts, images, parallel(browserSync, watcher));

export { scripts, styles, images, deploy };
export default dev;
export let build = series(cleandist, images, scripts, styles, buildcopy);
