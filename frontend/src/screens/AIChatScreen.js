import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Keyboard,
} from 'react-native';

import { scaleFont } from '../constants/responsive';
import { BASE_URL } from '../services/api';

export default function AIChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Xin chào! Tôi là trợ lý AI về chất lượng không khí và sức khỏe. Bạn muốn hỏi điều gì?',
      time: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const quickSuggestions = [
    'AQI hôm nay thế nào?',
    'Lời khuyên sức khỏe',
    'Dự báo tuần này',
    'Cách phòng tránh ô nhiễm',
  ];

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        scrollToBottom();
      }
    );
    return () => keyboardDidShowListener.remove();
  }, []);

  // Đảm bảo hàm send nhận tham số input trực tiếp để truyền đi chính xác
  const send = async (textParam) => {
    const text = (textParam ?? input).trim();
    if (!text) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Gọi trực tiếp đến Router chat: /chat (đã cấu hình prefix trong api_router)
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          session_id: "session-demo-2026"
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now(),
        sender: 'bot',
        text: data.answer,
        type: data.type,
        sql: data.sql,
        payloadData: data.data,
        time: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("❌ Chat API Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'bot',
          text: 'Rất tiếc, tôi không thể kết nối tới máy chủ AI Agent. Vui lòng kiểm tra lại kết nối mạng hoặc xem Backend FastAPI đã khởi động chưa nhé.',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    send(suggestion);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>AI</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Trợ lý AI</Text>
          <Text style={styles.headerSubtitle}>Hỏi mọi thứ về không khí & sức khỏe</Text>
        </View>
        <View style={styles.statusDot} />
      </View>

      <ScrollView
        style={styles.messagesWrapper}
        contentContainerStyle={styles.messagesContent}
        ref={messagesEndRef}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <View key={m.id}>
            <View style={[styles.messageRow, m.sender === 'user' ? styles.messageRowUser : styles.messageRowBot]}>
              {m.sender === 'bot' && (
                <View style={[styles.avatarBubble, styles.avatarBubbleBot]}>
                  <Text style={styles.avatarText}>A</Text>
                </View>
              )}

              <View style={[styles.messageBubble, m.sender === 'user' ? styles.messageBubbleUser : styles.messageBubbleBot]}>
                <Text style={[styles.messageText, m.sender === 'user' ? styles.messageTextUser : styles.messageTextBot]}>
                  {m.text}
                </Text>

                {m.sender === 'bot' && m.sql && (
                  <View style={styles.sqlContainer}>
                    <Text style={styles.sqlHeader}>🤖 AI Generated SQL Query:</Text>
                    <Text style={styles.sqlText}>{m.sql}</Text>
                  </View>
                )}

                {m.sender === 'bot' && m.payloadData && (
                  <View style={styles.dataContainer}>
                    <Text style={styles.dataHeader}>📊 Structured Data Response:</Text>
                    <Text style={styles.dataText}>{JSON.stringify(m.payloadData, null, 2)}</Text>
                  </View>
                )}

                <Text style={styles.timeText}>{m.time}</Text>
              </View>

              {m.sender === 'user' && (
                <View style={[styles.avatarBubble, styles.avatarBubbleUser]}>
                  <Text style={styles.avatarText}>U</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {isTyping && (
          <View style={[styles.messageRow, styles.messageRowBot]}>
            <View style={[styles.avatarBubble, styles.avatarBubbleBot]}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View style={[styles.messageBubble, styles.messageBubbleBot]}>
              <Text style={styles.typingDots}>•••</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <View style={styles.suggestionsWrapper}>
          <Text style={styles.suggestionsTitle}>Gợi ý câu hỏi</Text>
          <View style={styles.suggestionsGrid}>
            {quickSuggestions.map((sug) => (
              <TouchableOpacity
                key={sug}
                style={styles.suggestionButton}
                onPress={() => handleSuggestionClick(sug)}
              >
                <Text style={styles.suggestionText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputWrapper}>
        <View style={styles.inputInner}>
          <TextInput
            style={styles.input}
            placeholder="Nhập câu hỏi về chất lượng không khí..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            onFocus={scrollToBottom}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim()}
          >
            <Text style={[styles.sendText, !input.trim() && styles.sendTextDisabled]}>Gửi</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>
          AI có thể mắc lỗi. Hãy kiểm tra lại các thông tin quan trọng.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2ff', paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerAvatarText: { color: '#fff', fontWeight: '700' },
  headerTitle: { fontSize: scaleFont(18), fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: scaleFont(12), color: '#6b7280' },
  statusDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#22c55e' },
  messagesWrapper: { flex: 1 },
  messagesContent: { paddingHorizontal: 12, paddingBottom: 12 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowBot: { justifyContent: 'flex-start' },
  avatarBubble: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  avatarBubbleUser: { backgroundColor: '#4f46e5' },
  avatarBubbleBot: { backgroundColor: '#22c55e' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: scaleFont(12) },
  messageBubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  messageBubbleUser: { backgroundColor: '#4f46e5', borderBottomRightRadius: 4 },
  messageBubbleBot: { backgroundColor: '#ffffff', borderBottomLeftRadius: 4 },
  messageText: { fontSize: scaleFont(14) },
  messageTextUser: { color: '#f9fafb' },
  messageTextBot: { color: '#111827' },
  timeText: { fontSize: scaleFont(10), color: '#9ca3af', marginTop: 4, alignSelf: 'flex-end' },
  typingDots: { fontSize: scaleFont(18), letterSpacing: 2, color: '#6b7280' },
  suggestionsWrapper: { paddingHorizontal: 16, paddingBottom: 8 },
  suggestionsTitle: { fontSize: scaleFont(12), color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5e7eb' },
  suggestionText: { fontSize: scaleFont(12), color: '#374151' },
  inputWrapper: { paddingHorizontal: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 12, paddingTop: 4, backgroundColor: '#e5e7eb' },
  inputInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  input: { flex: 1, fontSize: scaleFont(14), color: '#111827', paddingVertical: 4, marginRight: 8 },
  sendButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#4f46e5' },
  sendButtonDisabled: { backgroundColor: '#d1d5db' },
  sendText: { color: '#ffffff', fontWeight: '600', fontSize: scaleFont(13) },
  sendTextDisabled: { color: '#6b7280' },
  disclaimer: { fontSize: scaleFont(10), color: '#6b7280', marginTop: 4, textAlign: 'center' },
  sqlContainer: { marginTop: 8, padding: 8, backgroundColor: '#1e1e2e', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#f5e0dc' },
  sqlHeader: { fontSize: scaleFont(11), color: '#a6adc8', fontWeight: '600', marginBottom: 2 },
  sqlText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: scaleFont(11), color: '#a6e3a1' },
  dataContainer: { marginTop: 6, padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  dataHeader: { fontSize: scaleFont(11), color: '#64748b', fontWeight: '600', marginBottom: 2 },
  dataText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: scaleFont(11), color: '#0f172a' },
});