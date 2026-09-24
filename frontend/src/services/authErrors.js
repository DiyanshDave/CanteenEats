export const getAuthErrorMessage = (error, action) => {
  if (!error.response) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  if (error.response.status === 401 && action === "login") {
    return "Email or password is incorrect. Please try again.";
  }

  if (error.response.status === 409 && action === "register") {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (error.response.status === 400) {
    return action === "register"
      ? "Please check your details and try creating your account again."
      : "Enter your email and password to continue.";
  }

  return action === "register"
    ? "We couldn't create your account right now. Please try again."
    : "We couldn't sign you in right now. Please try again.";
};
