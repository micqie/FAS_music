const CACHE_VERSION = '20260919-3';
const STATIC_CACHE = `fas-static-${CACHE_VERSION}`;
const PAGE_CACHE = `fas-pages-${CACHE_VERSION}`;
const OFFLINE_PAGE = './offline.html';
const PRECACHE = [
  "./",
  "./assets/data/philippines-cities.json",
  "./assets/data/philippines-provinces.json",
  "./assets/fas-logo.png",
  "./assets/fonts/font-1.ttf",
  "./assets/fonts/font-10.ttf",
  "./assets/fonts/font-11.ttf",
  "./assets/fonts/font-12.ttf",
  "./assets/fonts/font-13.ttf",
  "./assets/fonts/font-2.ttf",
  "./assets/fonts/font-3.ttf",
  "./assets/fonts/font-4.ttf",
  "./assets/fonts/font-5.ttf",
  "./assets/fonts/font-6.ttf",
  "./assets/fonts/font-7.ttf",
  "./assets/fonts/font-8.ttf",
  "./assets/fonts/font-9.ttf",
  "./assets/fonts/google-fonts.css",
  "./assets/images/about-music.jpg",
  "./assets/instruments/bass.png",
  "./assets/instruments/cello.png",
  "./assets/instruments/drums.png",
  "./assets/instruments/flute.png",
  "./assets/instruments/guitar.png",
  "./assets/instruments/piano.png",
  "./assets/instruments/saxophone.png",
  "./assets/instruments/ukelele.png",
  "./assets/instruments/violin.png",
  "./assets/instruments/voice.png",
  "./assets/vendor/bootstrap/css/bootstrap.min.css",
  "./assets/vendor/bootstrap/js/bootstrap.bundle.min.js",
  "./assets/vendor/flatpickr/flatpickr.min.css",
  "./assets/vendor/flatpickr/flatpickr.min.js",
  "./assets/vendor/fontawesome/css/all.min.css",
  "./assets/vendor/fontawesome/webfonts/fa-brands-400.woff2",
  "./assets/vendor/fontawesome/webfonts/fa-regular-400.woff2",
  "./assets/vendor/fontawesome/webfonts/fa-solid-900.woff2",
  "./assets/vendor/fontawesome/webfonts/fa-v4compatibility.woff2",
  "./assets/vendor/intl-tel-input/css/intlTelInput.css",
  "./assets/vendor/intl-tel-input/img/flags.png",
  "./assets/vendor/intl-tel-input/img/flags@2x.png",
  "./assets/vendor/intl-tel-input/js/intlTelInput.min.js",
  "./assets/vendor/intl-tel-input/js/utils.js",
  "./assets/vendor/js/axios.min.js",
  "./assets/vendor/js/chart.umd.min.js",
  "./assets/vendor/js/sweetalert2.min.js",
  "./assets/vendor/jsqr/jsQR.js",
  "./assets/vendor/lottie/lottie-player.js",
  "./assets/vendor/qrcode/qrcode.min.js",
  "./css/admin-responsive.css",
  "./css/auth-premium.css",
  "./css/desk-modals.css",
  "./css/desk-premium.css",
  "./css/home-polish.css",
  "./css/instructor.css",
  "./css/intl-phone-input.css",
  "./css/manager-shell.css",
  "./css/portal.css",
  "./css/style.css",
  "./css/table-responsive.css",
  "./css/tailwind-admin.input.css",
  "./css/tailwind-admin.min.css",
  "./css/tailwind.min.css",
  "./featured.html",
  "./index.html",
  "./js/admin/admin_audit_logs.js",
  "./js/admin/admin_dashboard.js",
  "./js/admin/admin_enrollments.js",
  "./js/admin/admin_instruments.js",
  "./js/admin/admin_learning_materials.js",
  "./js/admin/admin_payments.js",
  "./js/admin/admin_registration.js",
  "./js/admin/admin_reports.js",
  "./js/admin/admin_responsive.js",
  "./js/admin/admin_sessions.js",
  "./js/admin/admin_student_ledger.js",
  "./js/admin/admin_students.js",
  "./js/admin/admin_teachers.js",
  "./js/admin/admin_users.js",
  "./js/admin/branches.js",
  "./js/admin/maintenance.js",
  "./js/admin/packages.js",
  "./js/admin/rooms.js",
  "./js/admin/specializations.js",
  "./js/birthdate_validation.js",
  "./js/branch_room_occupancy.js",
  "./js/desk/desk_attendance.js",
  "./js/desk/desk_enrollment.js",
  "./js/desk/desk_makeup.js",
  "./js/desk/desk_nav.js",
  "./js/desk/desk_profile.js",
  "./js/desk/desk_registration.js",
  "./js/desk/desk_scan.js",
  "./js/desk/desk_session_requests.js",
  "./js/featured_public.js",
  "./js/home-polish.js",
  "./js/index.js",
  "./js/instructor/availability.js",
  "./js/instructor/grading.js",
  "./js/instructor/grading_ui.js",
  "./js/instructor/instructor_nav.js",
  "./js/instructor/learning_progress.js",
  "./js/instructor/profile.js",
  "./js/instructor/songs.js",
  "./js/intl-phone-input.js",
  "./js/manager/dashboard.js",
  "./js/manager_featured_posts.js",
  "./js/mode.js",
  "./js/offline.js",
  "./js/portal_sidebar.js",
  "./js/session_timeout.js",
  "./js/shared/teacher_form_ui.js",
  "./js/shared/teacher_occupied_calendar.js",
  "./js/student/student_shell.js",
  "./js/student/student_songs.js",
  "./js/table_responsive.js",
  "./js/xss-utils.js",
  "./logo/android-chrome-192x192.png",
  "./logo/android-chrome-512x512.png",
  "./logo/apple-touch-icon.png",
  "./logo/favicon-16x16.png",
  "./logo/favicon-32x32.png",
  "./logo/favicon.ico",
  "./manifest.webmanifest",
  "./offline.html",
  "./pages/admin/admin_audit_logs.html",
  "./pages/admin/admin_branches.html",
  "./pages/admin/admin_dashboard.html",
  "./pages/admin/admin_enrollments.html",
  "./pages/admin/admin_frozen_accounts.html",
  "./pages/admin/admin_instruments.html",
  "./pages/admin/admin_learning_materials.html",
  "./pages/admin/admin_maintenance.html",
  "./pages/admin/admin_package.html",
  "./pages/admin/admin_payments.html",
  "./pages/admin/admin_registration.html",
  "./pages/admin/admin_reports.html",
  "./pages/admin/admin_room.html",
  "./pages/admin/admin_sessions.html",
  "./pages/admin/admin_specializations.html",
  "./pages/admin/admin_student_ledger.html",
  "./pages/admin/admin_students.html",
  "./pages/admin/admin_teachers.html",
  "./pages/admin/admin_users.html",
  "./pages/desk/desk_attendance.html",
  "./pages/desk/desk_enrollment.html",
  "./pages/desk/desk_featured_posts.html",
  "./pages/desk/desk_freezeaccounts.html",
  "./pages/desk/desk_makeup.html",
  "./pages/desk/desk_profile.html",
  "./pages/desk/desk_registration.html",
  "./pages/desk/desk_scanner.html",
  "./pages/desk/desk_sessions.html",
  "./pages/guardian/guardian_absences.html",
  "./pages/guardian/guardian_dashboard.html",
  "./pages/guardian/guardian_payments.html",
  "./pages/guardian/guardian_profile.html",
  "./pages/guardian/guardian_students.html",
  "./pages/instructor/instructor_availability.html",
  "./pages/instructor/instructor_dashboard.html",
  "./pages/instructor/instructor_grading.html",
  "./pages/instructor/instructor_profile.html",
  "./pages/instructor/instructor_progress.html",
  "./pages/instructor/instructor_sessions.html",
  "./pages/instructor/instructor_songs.html",
  "./pages/instructor/instructor_students.html",
  "./pages/manager/manager_dashboard.html",
  "./pages/manager/manager_enrollments.html",
  "./pages/manager/manager_featured_posts.html",
  "./pages/manager/manager_frozen_accounts.html",
  "./pages/manager/manager_registration.html",
  "./pages/manager/manager_sessions.html",
  "./pages/manager/manager_teachers.html",
  "./pages/student/student_attendance.html",
  "./pages/student/student_dashboard.html",
  "./pages/student/student_grades.html",
  "./pages/student/student_profile.html",
  "./pages/student/student_qr.html",
  "./pages/student/student_sessions.html",
  "./pages/student/student_songs.html"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fas-') && ![STATIC_CACHE, PAGE_CACHE].includes(key)).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

function isApi(url) {
  return url.pathname.includes('/api/');
}

function isStaticAsset(url) {
  return /\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(PAGE_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request, { ignoreSearch: true })) || (await caches.match(OFFLINE_PAGE))));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
