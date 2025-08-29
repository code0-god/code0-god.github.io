# _plugins/code_runner.rb
require 'cgi'
require 'json'

module Jekyll
  class FileBlock < Liquid::Block
    # "foo.cpp" | 'foo.cpp' | foo.cpp | filename="foo.cpp" | filename='foo.cpp'
    SYNTAX = /\A\s*(?:filename=)?(?:"([^"]+)"|'([^']+)'|([^\s]+))\s*\z/

    def initialize(tag_name, markup, tokens)
      super
      m = markup.match(SYNTAX)
      raise SyntaxError, 'Valid syntax: {% file "filename.ext" %}' unless m
      @filename = m[1] || m[2] || m[3]
    end

    def render(context)
      # 내부 블록(파일 내용)을 먼저 렌더링
      content = super

      # CodeRunnerBlock 이 렌더 중일 때만 수집
      acc = context.registers[:__code_runner_acc]
      if acc.is_a?(Array)
        # 앞뒤 빈 줄 제거
        content = content.sub(/\A[ \t]*\r?\n/, '').sub(/\r?\n[ \t]*\z/, '')
        acc << { 'name' => @filename, 'content' => content }
        '' # 페이지에 원문 출력은 하지 않음
      else
        # CodeRunnerBlock 밖에서 쓰인 경우에는 그대로 출력
        content
      end
    end
  end

  class CodeRunnerBlock < Liquid::Block
    SYNTAX = /(id="([^"]+)"\s+language="([^"]+)")/ 

    def initialize(tag_name, markup, tokens)
      super
      unless markup =~ SYNTAX
        raise SyntaxError, 'Valid syntax: {% code_runner id="foo" language="cpp" %}'
      end
      @id, @language = $2, $3
    end

    def render(context)
      # FileBlock 들이 파일을 여기에 쌓습니다.
      context.registers[:__code_runner_acc] = []

      # 내부의 {% file %}{% endfile %}들을 렌더 → FileBlock#render 가 수집
      super

      files = context.registers.delete(:__code_runner_acc) || []

      if files.empty?
        return <<~HTML
          <div class="code-runner-wrapper" id="runner-#{@id}">
            <pre class="code-runner-console">No files provided. Put at least one:
{% file "main.cpp" %} ... {% endfile %}</pre>
          </div>
        HTML
      end

      payload = { id: @id, language: @language, files: files }.to_json

      tabs_html = files.map.with_index do |file, index|
        active_class = (index == 0) ? ' active' : ''
        name = file['name']
        %Q(<button class="code-runner-tab#{active_class}" data-runner-id="#{@id}" data-filename="#{CGI.escapeHTML(name)}">#{CGI.escapeHTML(name)}</button>)
      end.join

      iframe_src_params = "id=#{@id}&lang=#{CGI.escape(@language)}"
      iframe = <<~IFRAME
        <iframe class="code-runner-iframe"
          src="/embed/code_runner.html?#{iframe_src_params}"
          data-lang="#{CGI.escapeHTML(@language)}"
          style="width:100%;height:1px;border:0;padding:0;display:block;"
          frameborder="0"
          allow="clipboard-write"></iframe>
      IFRAME

      <<~HTML
        <div class="code-runner-wrapper" id="runner-#{@id}">
          <div class="code-runner-header">
            <div class="code-runner-tabs">#{tabs_html}</div>
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
Liquid::Template.register_tag('file', Jekyll::FileBlock)