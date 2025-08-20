# _plugins/code_runner.rb
require 'cgi'
require 'json'

module Jekyll
  class CodeRunnerBlock < Liquid::Block
    SYNTAX = /(id="([^"]+)"\s+language="([^"]+)"(?:\s+filename="([^"]+)")?)/

    def initialize(tag_name, markup, tokens)
      super
      unless markup =~ SYNTAX
        raise SyntaxError, 'Valid syntax: {% code_runner id="foo" language="cpp" [filename="bar"] %}'
      end
      @id, @language, @filename = $2, $3, $4
    end

    def trim_edge_blank_lines(s)
      # 맨 앞 1줄, 맨 뒤 1줄만 ‘빈 줄(공백+개행)’이면 제거
      s = s.sub(/\A[ \t]*\r?\n/, '')
      s = s.sub(/\r?\n[ \t]*\z/, '')
      s
    end

    def render(context)
      raw  = super                       # 원문 캡처
      code = trim_edge_blank_lines(raw)  # <- 앞/뒤 빈 줄 제거

      lang = @language.to_s.empty? ? 'cpp' : @language
      fname =
        if @filename.to_s.empty?
          ext = (lang == 'cpp' ? 'cpp' : lang)
          "main.#{ext}"
        else
          @filename.include?('.') ? @filename : "#{@filename}.#{lang}"
        end

      payload = { code: code, lang: lang, filename: fname }.to_json

      iframe = <<~IFRAME
        <iframe class="code-runner-iframe"
          src="/embed/code_runner.html?id=#{@id}&lang=#{CGI.escape(lang)}&filename=#{CGI.escape(fname)}"
          data-lang="#{CGI.escapeHTML(lang)}"
          data-filename="#{CGI.escapeHTML(fname)}"
          style="width:100%;height:1px;border:0;padding:0;display:block;"
          frameborder="0"
          allow="clipboard-write"
        ></iframe>
      IFRAME

      <<~HTML
        <div class="code-runner-wrapper" id="runner-#{@id}">
          <div class="code-runner-header">
            <span class="code-runner-filename">#{CGI.escapeHTML(fname)}</span>
            <button class="code-runner-run" data-runner-id="#{@id}">Run ▶</button>
          </div>

          <script id="cr-code-#{@id}" type="application/json">#{payload}</script>

          <div id="editor-#{@id}" class="code-runner-editor">
            #{iframe}
          </div>

          <pre id="console-#{@id}" class="code-runner-console">Click Run ▶</pre>
        </div>
      HTML
    end
  end
end

Liquid::Template.register_tag('code_runner', Jekyll::CodeRunnerBlock)
