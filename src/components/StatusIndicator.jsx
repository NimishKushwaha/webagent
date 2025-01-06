import PropTypes from 'prop-types';

const StatusIndicator = ({ status }) => {
  return (
    <div className="status-indicator">
      {status}
      {status === 'Preparing audio response...' && (
        <span className="loading-dots">...</span>
      )}
    </div>
  );
};

StatusIndicator.propTypes = {
  status: PropTypes.string.isRequired
};

export default StatusIndicator; 