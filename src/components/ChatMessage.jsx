import PropTypes from 'prop-types';

const ChatMessage = ({ message, type }) => {
  return (
    <div className={`message ${type}-message`}>
      {message}
      <div className="message-avatar">
        {type === 'ai' ? '🤖' : '👤'}
      </div>
    </div>
  );
};

ChatMessage.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['user', 'ai']).isRequired
};

export default ChatMessage; 