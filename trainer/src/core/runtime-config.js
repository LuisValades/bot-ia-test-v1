const state = {
  autoCommitOverride: null,
  autoPushOverride: null
};

export const runtime = {
  autoCommitEnabled() {
    if (state.autoCommitOverride !== null) return state.autoCommitOverride;
    return process.env.GIT_AUTO_COMMIT === 'true';
  },
  autoPushEnabled() {
    if (state.autoPushOverride !== null) return state.autoPushOverride;
    return process.env.GIT_AUTO_PUSH === 'true';
  },
  setAutoCommit(value) {
    state.autoCommitOverride = value === null ? null : Boolean(value);
  },
  setAutoPush(value) {
    state.autoPushOverride = value === null ? null : Boolean(value);
  },
  status() {
    return {
      autoCommit: runtime.autoCommitEnabled(),
      autoPush: runtime.autoPushEnabled(),
      envAutoCommit: process.env.GIT_AUTO_COMMIT === 'true',
      envAutoPush: process.env.GIT_AUTO_PUSH === 'true',
      runtimeOverride: {
        autoCommit: state.autoCommitOverride,
        autoPush: state.autoPushOverride
      }
    };
  }
};
