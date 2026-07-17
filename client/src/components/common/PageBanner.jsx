import { Link } from 'react-router-dom';

const plusIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const keyIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const actionClassName =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-white text-primary-800 rounded-xl text-sm font-bold shadow-lg shadow-primary-900/30 flex-shrink-0';

/**
 * @param {{ title: string, subtitle: string, action?: BannerAction | BannerAction[] | null, className?: string }} props
 * @typedef {{ to: string, label: string }} BannerLinkAction
 * @typedef {{ onClick: () => void, label: string, icon?: 'plus' | 'key' }} BannerButtonAction
 * @typedef {BannerLinkAction | BannerButtonAction} BannerAction
 */
const PageBanner = ({ title, subtitle, action = null, className = '' }) => {
  const actionsList = Array.isArray(action) ? action : action ? [action] : [];

  const iconFor = (act) => ('icon' in act && act.icon === 'key' ? keyIcon : plusIcon);

  const renderActions = () => {
    if (actionsList.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 justify-end flex-shrink-0">
        {actionsList.map((act, idx) => {
          if (act.to) {
            return (
              <Link key={`${act.to}-${act.label}`} to={act.to} className={actionClassName}>
                {plusIcon}
                {act.label}
              </Link>
            );
          }
          if (typeof act.onClick === 'function') {
            return (
              <button key={`${act.label}-${idx}`} type="button" onClick={act.onClick} className={actionClassName}>
                {iconFor(act)}
                {act.label}
              </button>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div
      className={`bg-gradient-to-br from-[#0b2f81] via-[#1446a0] to-[#1d5fb3] rounded-2xl px-4 py-3 text-white relative overflow-hidden ${className}`.trim()}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
      <div className="absolute -bottom-8 -right-4 w-24 h-24 bg-white/5 rounded-full" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-0.5">{title}</h2>
          <p className="text-primary-200 text-md">{subtitle}</p>
        </div>
        {renderActions()}
      </div>
    </div>
  );
};

export default PageBanner;
