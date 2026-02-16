import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Shield, CheckCircle, XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { otpService } from '../services/otp';
import { api } from '../services/api';
import { Input } from './Shared';

interface PatientRegistrationProps {
  onBack: () => void;
  onRegistrationComplete: () => void;
}

const PatientSelfRegistration: React.FC<PatientRegistrationProps> = ({ onBack, onRegistrationComplete }) => {
  // Changed flow: email + password first, then OTP verification
  const [step, setStep] = useState<'signup' | 'otp' | 'complete'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    
    try {
      // Check if email is already registered in patient_auth
      const isRegistered = await otpService.isEmailRegistered(email);
      if (isRegistered) {
        setError('This email is already registered. Please use a different email or login instead.');
        setLoading(false);
        return;
      }
      
      // Sign up with Supabase Auth (sends OTP email automatically)
      const result = await otpService.signUpWithPassword(email, password);
      
      if (result.success) {
        if (result.userId) {
          setSupabaseUserId(result.userId);
        }
        setSuccess(result.message || 'Please check your email for the verification code.');
        setStep('otp');
      } else {
        setError(result.message || 'Failed to create account');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      // Verify OTP with Supabase Auth
      const result = await otpService.verifySignupOTP(email, otp);
      
      if (result.success) {
        // OTP verified - now create patient record
        const userId = result.userId || supabaseUserId;
        
        // Create patient record linked to Supabase Auth user
        await (api.patients as any).registerWithSupabase(email, password, userId);
        
        setSuccess('Account created successfully!');
        setStep('complete');
        
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          onRegistrationComplete();
        }, 2000);
      } else {
        setError(result.message || 'Invalid or expired verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setResending(true);
    
    try {
      const result = await otpService.resendOTP(email);
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(numericValue);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Registration</h1>
            <p className="text-gray-600">
              {step === 'signup' && 'Create your account'}
              {step === 'otp' && 'Verify your email'}
              {step === 'complete' && 'Registration Complete!'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'signup' ? 'bg-indigo-600 text-white' : 
                step === 'otp' || step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'signup' ? '1' : <CheckCircle className="w-5 h-5" />}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'otp' ? 'bg-indigo-600 text-white' : 
                step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'otp' ? '2' : step === 'complete' ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step === 'complete' ? <CheckCircle className="w-5 h-5" /> : '3'}
              </div>
            </div>
          </div>

          {/* Signup Step - Email and Password */}
          {step === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full"
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <ul className="space-y-1">
                  <li className="flex items-center gap-1">
                    {password.length >= 6 ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    At least 6 characters
                  </li>
                  <li className="flex items-center gap-1">
                    {password && password === confirmPassword ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    Passwords match
                  </li>
                </ul>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {success}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading || password.length < 6 || password !== confirmPassword}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Verification Code
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Enter the 6-digit code sent to <span className="font-medium">{email}</span>
                </p>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className="w-full text-center text-2xl tracking-widest"
                />
              </div>
              
              <div className="text-sm text-gray-600 text-center">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resending}
                  className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                >
                  {resending ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    'Resend Code'
                  )}
                </button>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {success}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('signup')}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Verify & Complete
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Registration Complete!</h2>
              <p className="text-gray-600">
                Your account has been created successfully. You can now login to access your dashboard.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-medium mb-1">Your Login Credentials:</p>
                <p><span className="font-medium">Email:</span> {email}</p>
                <p><span className="font-medium">Password:</span> (The password you set)</p>
              </div>
            </div>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBack}
              className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientSelfRegistration;