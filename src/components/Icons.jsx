const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconHome = (props) => (
  <svg {...base} {...props}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconBooks = (props) => (
  <svg {...base} {...props}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.8 1.8 0 0 0-1.6-1H5.5A1.5 1.5 0 0 1 4 16.5z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.8 1.8 0 0 1 1.6-1h4.9a1.5 1.5 0 0 0 1.5-1.5z" />
  </svg>
);

export const IconLoans = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const IconPlus = (props) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const IconClose = (props) => (
  <svg {...base} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconExit = (props) => (
  <svg {...base} {...props}>
    <path d="M15 12H5m3-3-3 3 3 3" />
    <path d="M11 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
  </svg>
);

export const IconCheck = (props) => (
  <svg {...base} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconRotateLeft = (props) => (
  <svg {...base} {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const IconRotateRight = (props) => (
  <svg {...base} {...props}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const IconTrash = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
  </svg>
);

export const IconEdit = (props) => (
  <svg {...base} {...props}>
    <path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </svg>
);

export const IconBook = (props) => (
  <svg {...base} {...props}>
    <path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" />
    <path d="M17 7.5h2v12h-2" />
  </svg>
);

export const IconEye = (props) => (
  <svg {...base} {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = (props) => (
  <svg {...base} {...props}>
    <path d="M3.5 3.5l17 17" />
    <path d="M10.6 5.7A10.4 10.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.2 4.1M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.9 9.9 0 0 0 3.9-.8" />
    <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const IconCamera = (props) => (
  <svg {...base} {...props}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.1-1.7A1.5 1.5 0 0 1 10.1 4.6h3.8a1.5 1.5 0 0 1 1.3.7L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

export const IconImage = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.4" />
    <path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17" />
  </svg>
);

export const IconLink = (props) => (
  <svg {...base} {...props}>
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
);

export const IconChevronLeft = (props) => (
  <svg {...base} {...props}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
);

export const IconChevronDown = (props) => (
  <svg {...base} {...props}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconPlay = (props) => (
  <svg {...base} {...props}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);

export const IconPause = (props) => (
  <svg {...base} {...props}>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </svg>
);

export const IconTag = (props) => (
  <svg {...base} {...props}>
    <path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4z" />
    <circle cx="8.2" cy="8.2" r="1.3" />
  </svg>
);

export const IconPalette = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3.6c-4.7 0-8.4 3.7-8.4 8.4s3.7 8.4 8.4 8.4c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7h1.2a4.5 4.5 0 0 0 4.5-4.5c0-3.6-3.7-6.5-8.4-6.5z" />
    <circle cx="8.1" cy="9.2" r="1.1" />
    <circle cx="12" cy="7.4" r="1.1" />
    <circle cx="15.8" cy="9.6" r="1.1" />
  </svg>
);

export const IconSettings = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.1 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 0 1-3.8 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a1.9 1.9 0 0 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.9 1.9 0 0 1 0-3.8h.3a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a1.9 1.9 0 0 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a1.9 1.9 0 0 1 3.8 0v.3a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 0 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 0 1 0 3.8h-.3a1.6 1.6 0 0 0-1.4 1z" />
  </svg>
);

export const IconUsers = (props) => (
  <svg {...base} {...props}>
    <path d="M15.5 19.5V18a3.5 3.5 0 0 0-3.5-3.5H7A3.5 3.5 0 0 0 3.5 18v1.5" />
    <circle cx="9.5" cy="7.5" r="3.3" />
    <path d="M20.5 19.5V18a3.5 3.5 0 0 0-2.6-3.4" />
    <path d="M15.5 4.7a3.3 3.3 0 0 1 0 5.6" />
  </svg>
);

export const IconShield = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3.3 19 6v5.4c0 4-2.9 7.5-7 8.6-4.1-1.1-7-4.6-7-8.6V6z" />
    <path d="m9.2 11.9 2 2 3.6-3.7" />
  </svg>
);

export const IconChat = (props) => (
  <svg {...base} {...props}>
    <path d="M20 11.6c0 3.8-3.6 6.9-8 6.9-.9 0-1.8-.1-2.6-.4L5 19.8l1.2-3.1A6.5 6.5 0 0 1 4 11.6c0-3.8 3.6-6.9 8-6.9s8 3.1 8 6.9z" />
  </svg>
);

export const IconCrown = (props) => (
  <svg {...base} {...props}>
    <path d="M5.6 16.6 4.3 7.5l4.3 3.4L12 5.3l3.4 5.6 4.3-3.4-1.3 9.1z" />
    <path d="M5.8 19.6h12.4" />
  </svg>
);

export const IconUser = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20v-1a4.2 4.2 0 0 1 4.2-4.2h6a4.2 4.2 0 0 1 4.2 4.2v1" />
  </svg>
);

export const IconWhatsapp = (props) => (
  <svg
    viewBox="0 0 400 400"
    fill="none"
    stroke="currentColor"
    strokeWidth={16}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M84.7925 257.334C1.81069 106.044 237.525 -11.6463 321.16 119.453C396.366 237.339 251.357 391.573 150.736 312.145" />
    <path d="M89.5909 265.912C34.5405 357.344 49.8143 347.445 133.267 311.303" />
    <path d="M170.381 113.42C60.1005 141.74 240.793 341.184 288.582 236.047" />
    <path d="M177.338 175.365C186.032 197.073 208.905 214.528 227.906 227.195" />
    <path d="M177.338 126.062C187.693 143.231 203.319 159.586 178.602 168.412" />
    <path d="M285.431 228.46C262.184 210.573 250.584 200.134 232.965 225.301" />
  </svg>
);
