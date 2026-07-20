import { Component, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, clearError } from '../../features/auth/authSlice';
import toast from 'react-hot-toast';
import inbestLogo from '../../../assets/white_inbest_logo.png';
import PasswordInput from '../../components/common/PasswordInput';
import Ballpit from '../../components/effects/Ballpit';

class BallpitBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('[Ballpit] render error:', error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);
  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
    return () => dispatch(clearError());
  }, [isAuthenticated, navigate, dispatch]);

  const onSubmit = async (data) => {
    const result = await dispatch(login(data));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="login-page__bg" aria-hidden="true">
        <BallpitBoundary>
          <Ballpit
            className="ballpit-bg"
            count={60}
            gravity={0.7}
            friction={0.8}
            wallBounce={0.95}
            followCursor
            colors={[0x9ec5ff, 0x4d8ef0, 0xffffff, 0x7eb6ff]}
            ambientColor={0xffffff}
            ambientIntensity={1.1}
            lightIntensity={110}
            minSize={0.65}
            maxSize={1.35}
            materialParams={{
              metalness: 0.08,
              roughness: 0.28,
              clearcoat: 0.5,
              clearcoatRoughness: 0.25,
              emissive: 0x143a6e,
              emissiveIntensity: 0.25
            }}
          />
        </BallpitBoundary>
      </div>

      <div className="login-page__overlay" aria-hidden="true" />

      <div className="login-page__content w-full max-w-md">
        {/* Card */}
        <div className="bg-transparent border-2 border-white/20 backdrop-blur-[13px] px-6 py-8 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)]">
          {/* Logo */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-4">
              <img src={inbestLogo} alt="Inbest Logo" className="w-25 h-25 object-contain" />
            </div>
            {/* <h1 className="text-2xl font-bold text-white">PO SYSTEM</h1> */}
            <p className="text-white/90 text-lg mt-1">Purchase Order Management System</p>
          </div>


          <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign In</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="you@company.com"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-1">Password</label>
              <PasswordInput
                className="login-input login-input--with-toggle"
                toggleClassName="text-white hover:text-white focus:ring-white/40"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
