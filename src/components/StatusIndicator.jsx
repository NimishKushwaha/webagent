import PropTypes from 'prop-types';

const StatusIndicator = ({ status }) => {
  return (
    <div className="status-indicator">
      {status === 'Listening...' && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording in progress</span>
        </div>
      )}
      {status !== 'Listening...' && <span>{status}</span>}
    </div>
  );
};

StatusIndicator.propTypes = {
  status: PropTypes.string.isRequired
};

export default StatusIndicator; 