# _plugins/rouge_cpp_ext.rb
# frozen_string_literal: true
# -------------------------------------------------
#  Rouge C++ Lexer Extension (v2.9)
# -------------------------------------------------
require 'rouge'
require 'rouge/lexers/cpp'
require 'strscan'

module Rouge
  module Lexers
    class Cpp
      # ────────────────────────────────────────────────
      # 1. 분류용 상수
      # ────────────────────────────────────────────────
      STL_TYPES   = %w[
        vector string wstring wstringstream array optional pair tuple map set
        unordered_map unordered_set
      ].freeze

      STL_OBJECTS = %w[
        cout cerr clog cin wcout wcin endl
      ].freeze

      DECLARE_KW  = %w[class struct enum union template typename].freeze
      TYPE_KW     = %w[int long short signed unsigned char float double bool void auto].freeze
      CONST_KW    = %w[const constexpr].freeze
      RESERVED_KW = %w[for if while switch case default break continue return goto try catch throw do].freeze

      OTHER_KW    = %w[
        alignas alignof asm decltype default delete explicit export extern false friend
        inline mutable new noexcept nullptr operator reinterpret_cast static static_assert
        static_cast this thread_local true typedef typeid using volatile wchar_t
      ].freeze

      # ────────────────────────────────────────────────
      # 2. root 상태 보강
      # ────────────────────────────────────────────────
      prepend :root do
        # 접근 지정자 public: private: protected:
        rule %r/\b(public|private|protected)(\s*):(?!:)/ do |m|
          token Name::Label,   m[1]
          token Text::Whitespace, m[2]
          token Punctuation,   m[3]
        end

        # template<typename T> 의 T 등 대문자 타입
        rule %r/\b[A-Z]\w*\b/, Name::Class
      end

      # ────────────────────────────────────────────────
      # 3. #include <...>
      # ────────────────────────────────────────────────
      prepend :root do
        rule %r{
          ^(\s*)
          (\#\s*include)
          (\s+)
          (<)
          ([A-Za-z_]\w*)
          (\.\w+)?      # .h/.hpp
          (>)
        }x do |m|
          token Text,             m[1]
          token Comment::Preproc, m[2]
          token Text::Whitespace, m[3]
          token Punctuation,      m[4]
          hdr = m[5]
          # include 헤더는 STL 종류 상관없이 항상 Builtin
          if (STL_TYPES + STL_OBJECTS).include?(hdr)
            token Name::Builtin, hdr
          else
            token Name::Constant, hdr
          end
          token Name::Namespace,  m[6] if m[6]
          token Punctuation,      m[7]
        end
      end

      # ────────────────────────────────────────────────
      # 4. #define (객체/함수형 통합)
      # ────────────────────────────────────────────────
      prepend :root do
        rule %r{
          ^(\s*)
          (\#\s*define)
          (\s+)
          ([A-Za-z_]\w*)    # 매크로명
          (\s*)
          (\([^)]*\))?      # 선택적 파라미터
          (\s*)
          (.*)$             # 본문
        }x do |m|
          token Text,             m[1]
          token Comment::Preproc, m[2]
          token Text::Whitespace, m[3]
          token Name::Constant,   m[4]
          token Text::Whitespace, m[5]
          if m[6]
            token Punctuation, '('
            m[6][1..-2].scan(/[A-Za-z_]\w*|\s+|,/) do |p|
              case p
              when /\A\s+\z/ then token Text::Whitespace, p
              when ','       then token Punctuation,      p
              else               token Name::Variable,    p
              end
            end
            token Punctuation, ')'
          end
          token Text::Whitespace, m[7]
          lex_macro_body(m[8])
        end
      end

      # ────────────────────────────────────────────────
      # 5. statements 상태
      # ────────────────────────────────────────────────
      prepend :statements do
        # 5-0. 생성자 초기화 리스트: “: value(…” → value는 변수
        rule %r{(:)(\s*)([A-Za-z_]\w*)(?=\s*\()}x do |m|
          token Punctuation,      m[1]
          token Text::Whitespace, m[2]
          token Name::Variable,   m[3]
        end

        # 5-a. 선언 키워드
        rule %r/\b(?:#{DECLARE_KW.join('|')})\b/, Keyword::Declaration

        # 5-b. 타입 키워드
        rule %r/\b(?:#{TYPE_KW.join('|')})\b/, Keyword::Type

        # 5-c. 상수 키워드
        rule %r/\b(?:#{CONST_KW.join('|')})\b/, Keyword::Constant

        # 5-d. 제어 흐름 키워드
        rule %r/\b(?:#{RESERVED_KW.join('|')})\b/, Keyword::Reserved

        # 5-e. 기타 키워드
        rule %r/\b(?:#{OTHER_KW.join('|')})\b/, Keyword

        # 5-f. std 네임스페이스
        rule %r/\bstd\b/, Keyword::Namespace

        # 5-g. STL 식별자 (std::vector 등)
        rule %r{(?<=\bstd::)(#{(STL_TYPES + STL_OBJECTS).join('|')})\b}x do |m|
          token((STL_TYPES.include?(m[1]) ? Name::Class : Name::Builtin), m[1])
        end
        rule %r/\b(#{(STL_TYPES + STL_OBJECTS).join('|')})\b/x do |m|
          token((STL_TYPES.include?(m[1]) ? Name::Class : Name::Builtin), m[1])
        end

        # 5-h. 의도적 오류 토큰 '?'
        rule %r/\?/, Error

        # 5-i. 생성자·멤버 함수 감지
        rule %r{
          \b
          (?:[A-Za-z_]\w*::)*   # optional scope
          ([A-Za-z_]\w*)        # id
          (?=\s*\()
        }x do |m|
          token Name::Function, m[1]
        end

        # 5-j. 그 외 사용자 정의 타입
        rule %r/\b[A-Z]\w*\b/, Name::Class
      end

      # ────────────────────────────────────────────────
      # 6. namespace 선언 (std 제외)
      # ────────────────────────────────────────────────
      prepend :root do
        rule %r{(\bnamespace\b)(\s+)([A-Za-z_]\w*)} do |m|
          token Keyword::Namespace, m[1]
          token Text::Whitespace,   m[2]
          token Name::Namespace,    m[3]
        end
      end

      # ────────────────────────────────────────────────
      # 7. 매크로 본문 스캐너
      # ────────────────────────────────────────────────
      def lex_macro_body(text)
        scanner = StringScanner.new(text)
        until scanner.eos?
          case
          when scanner.scan(%r{//.*})
            token Comment::Single, scanner.matched; break
          when scanner.scan(/\s+/)
            token Text::Whitespace, scanner.matched
          when scanner.scan(/\d+(?:\.\d+)?/)
            token Literal::Number,  scanner.matched
          when scanner.scan(/[A-Za-z_]\w*/)
            id = scanner.matched
            if    STL_TYPES.include?(id)   then token Name::Class,   id
            elsif STL_OBJECTS.include?(id) then token Name::Builtin, id
            else                             token Name::Variable, id
            end
          when scanner.scan(/[+\-*\/%|&^~<>!=(){}\[\],.:;]/)
            token Punctuation,      scanner.matched
          else
            token Text,             scanner.getch
          end
        end
      end
      private :lex_macro_body
    end
  end
end
