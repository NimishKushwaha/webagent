import PropTypes from 'prop-types';

const CallControls = ({ isCallActive, onStartCall, onEndCall }) => {
  return (
    <div className="controls">
      <button 
        className={`primary-button start`}
        onClick={onStartCall}
        disabled={isCallActive}
      >
        {isCallActive ? '📞 Connected' : '📞 Start Call'}
      </button>
      <button 
        className={`primary-button end`}
        onClick={onEndCall}
        disabled={!isCallActive}
      >
        🔚 End Call
      </button>
    </div>
  );
};

CallControls.propTypes = {
  isCallActive: PropTypes.bool.isRequired,
  onStartCall: PropTypes.func.isRequired,
  onEndCall: PropTypes.func.isRequired
};

export default CallControls; 